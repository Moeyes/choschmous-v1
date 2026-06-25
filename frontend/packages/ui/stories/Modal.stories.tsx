import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/button';

/**
 * The single, unified Modal (CHOS-405 consolidated the former Modal + ModalV2
 * into this one component). It supports both the simple `isOpen/onClose` style
 * and the standard `[Cancel] [Primary]` confirm footer.
 */
const meta = {
  title: 'Primitives/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    confirmVariant: { control: 'select', options: ['default', 'destructive'] },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ModalDemo(props: Partial<React.ComponentProps<typeof Modal>>) {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Edit participant"
        description="Update the athlete's details and save your changes."
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          Modal body content goes here. Focus is trapped, Esc closes, the
          backdrop click closes, and focus is restored to the trigger on close.
        </p>
      </Modal>
    </div>
  );
}

export const Simple: Story = {
  render: () => <ModalDemo />,
};

export const WithConfirmFooter: Story = {
  render: () => (
    <ModalDemo
      onConfirm={() => undefined}
      confirmText="Save changes"
      cancelText="Cancel"
    />
  ),
};

export const Destructive: Story = {
  render: () => (
    <ModalDemo
      size="xs"
      title="Delete participant"
      description="This action cannot be undone."
      confirmVariant="destructive"
      confirmText="Delete"
      onConfirm={() => undefined}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <ModalDemo confirmText="Saving…" confirmLoading onConfirm={() => undefined} />
  ),
};
