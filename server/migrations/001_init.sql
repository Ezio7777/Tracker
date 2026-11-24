-- Initial schema for the task and ticket tracker (PostgreSQL 13 or newer).
-- The migration runner wraps this file in a transaction, so it either fully applies or not at all.

-- Keeps updated_at honest no matter which code path changes a row.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  email         text        NOT NULL CHECK (email = lower(email)),
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)
);

-- ------------------------------------------------------------- projects
-- A project has exactly one manager (its owner) and any number of members.
CREATE TABLE projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  description text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  manager_id  uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status      text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_manager_name_key UNIQUE (manager_id, name)
);

CREATE TABLE project_members (
  project_id uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user_idx ON project_members (user_id);

-- ----------------------------------------------------------- work items
-- One table for both tasks and tickets.
CREATE TABLE work_items (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 text        NOT NULL CHECK (type IN ('TASK', 'TICKET')),
  title                text        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  description          text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  status               text        NOT NULL,
  priority             text        NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  project_id           uuid        REFERENCES projects (id) ON DELETE RESTRICT,
  requester_id         uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assignee_id          uuid        REFERENCES users (id) ON DELETE SET NULL,
  due_date             timestamptz,
  due_soon_notified_at timestamptz,
  escalated_at         timestamptz,
  deleted_at           timestamptz,
  deleted_by           uuid        REFERENCES users (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- A task always belongs to a project. A ticket may or may not.
  CONSTRAINT work_items_task_needs_project CHECK (type <> 'TASK' OR project_id IS NOT NULL),
  -- Each type has its own set of statuses (ESCALATED only exists for tickets).
  CONSTRAINT work_items_status_matches_type CHECK (
    (type = 'TASK'   AND status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED')) OR
    (type = 'TICKET' AND status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'))
  )
);

-- Most lists skip soft-deleted rows, so the common indexes only cover live rows.
CREATE INDEX work_items_project_status_idx  ON work_items (project_id, status)  WHERE deleted_at IS NULL;
CREATE INDEX work_items_assignee_status_idx ON work_items (assignee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX work_items_requester_idx       ON work_items (requester_id)        WHERE deleted_at IS NULL;
CREATE INDEX work_items_type_status_idx     ON work_items (type, status, priority) WHERE deleted_at IS NULL;
CREATE INDEX work_items_due_date_idx        ON work_items (due_date) WHERE deleted_at IS NULL AND assignee_id IS NOT NULL;
CREATE INDEX work_items_created_idx         ON work_items (created_at DESC) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------- comments
CREATE TABLE comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
  author_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  body         text        NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_work_item_idx ON comments (work_item_id, created_at);

-- -------------------------------------------------------- notifications
CREATE TABLE notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type IN ('ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'TICKET_CREATED', 'DUE_SOON', 'ESCALATED')),
  message      text        NOT NULL,
  entity_type  text        NOT NULL DEFAULT 'WORK_ITEM' CHECK (entity_type = 'WORK_ITEM'),
  entity_id    uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
  is_read      boolean     NOT NULL DEFAULT false,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX notifications_created_idx   ON notifications (created_at);

-- --------------------------------------------- history (activity / audit)
CREATE TABLE work_item_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
  actor_id     uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  action       text        NOT NULL CHECK (action IN ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'ESCALATED', 'COMMENTED', 'UPDATED', 'DELETED')),
  from_value   text,
  to_value     text,
  meta         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_item_history_item_idx ON work_item_history (work_item_id, created_at);

-- -------------------------------------------------------- refresh tokens
-- Only a hash of the token is stored, so a database leak does not expose live sessions.
CREATE TABLE refresh_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text        NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refresh_tokens_hash_key UNIQUE (token_hash)
);
CREATE INDEX refresh_tokens_user_idx    ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

-- --------------------------------------------------------- triggers
CREATE TRIGGER users_set_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at   BEFORE UPDATE ON projects   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER work_items_set_updated_at BEFORE UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
