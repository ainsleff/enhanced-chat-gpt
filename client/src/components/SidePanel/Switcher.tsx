import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { useListAssistantsQuery } from 'librechat-data-provider/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/Select';
import { useChatContext } from '~/Providers';
import { cn } from '~/utils';
import store from '~/store';

interface SwitcherProps {
  isCollapsed: boolean;
}

export default function Switcher({ isCollapsed }: SwitcherProps) {
  const { index } = useChatContext();
  const [selectedAssistant, setSelectedAssistant] = useRecoilState(store.assistantByIndex(index));
  const { data: assistants = [] } = useListAssistantsQuery(
    {
      order: 'asc',
    },
    {
      select: (res) => res.data.map(({ id, name }) => ({ id, name })),
    },
  );

  useEffect(() => {
    if (!selectedAssistant && assistants && assistants.length) {
      setSelectedAssistant(assistants[0].id);
    }
  }, [assistants, selectedAssistant, setSelectedAssistant]);

  return (
    <Select
      defaultValue={selectedAssistant as string | undefined}
      onValueChange={setSelectedAssistant}
    >
      <SelectTrigger
        className={cn(
          'flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
          isCollapsed
            ? 'flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden'
            : '',
          'bg-white',
        )}
        aria-label="Select account"
      >
        <SelectValue placeholder="Select an Assistant">
          {/* TODO: assistant icon */}
          <span className={cn('ml-2', isCollapsed ? 'hidden' : '')}>
            {assistants.find((assistant) => assistant.id === selectedAssistant)?.name}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-white">
        {assistants.map((assistant) => (
          <SelectItem key={assistant.id} value={assistant.id}>
            <div className="[&_svg]:text-foreground flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 ">
              {/* {TODO: assistant.icon} */}
              {assistant.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
