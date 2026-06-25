import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/shared/ui/input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'Enter a value…' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex w-72 flex-col gap-1.5">
      <label htmlFor="full-name" className="text-sm font-medium text-foreground">
        Full name
      </label>
      <Input id="full-name" {...args} placeholder="Jane Doe" />
    </div>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <div className="flex w-72 flex-col gap-1.5">
      <label htmlFor="email" className="text-sm font-medium text-foreground">
        Email
      </label>
      <Input id="email" type="email" aria-invalid {...args} defaultValue="not-an-email" aria-describedby="email-error" />
      <p id="email-error" className="text-xs text-destructive">
        Enter a valid email address.
      </p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read only' },
};
