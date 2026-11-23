'use client';
import WorkItemForm from '@/components/WorkItemForm';

export default function NewWorkItemPage({ searchParams }) {
  return <WorkItemForm initialProject={searchParams?.project || ''} />;
}
