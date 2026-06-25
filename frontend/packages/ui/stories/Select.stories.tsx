import type { Meta, StoryObj } from '@storybook/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

const meta = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <Select defaultValue="football">
        <SelectTrigger aria-label="Sport">
          <SelectValue placeholder="Select a sport" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="football">Football</SelectItem>
          <SelectItem value="volleyball">Volleyball</SelectItem>
          <SelectItem value="athletics">Athletics</SelectItem>
          <SelectItem value="swimming">Swimming</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Placeholder: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <SelectTrigger aria-label="Province">
          <SelectValue placeholder="Choose a province" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="phnom-penh">Phnom Penh</SelectItem>
          <SelectItem value="siem-reap">Siem Reap</SelectItem>
          <SelectItem value="battambang">Battambang</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
