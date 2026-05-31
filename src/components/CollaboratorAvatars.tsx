import React from 'react';
import { Friend } from '@/modules/friends';
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup, AvatarGroupCount } from './ui/avatar';
import { cn } from '@/lib/utils';

interface CollaboratorAvatarsProps {
  collaboratorIds?: string[];
  friends: Friend[];
  className?: string;
  size?: 'sm' | 'md';
  maxVisible?: number;
}

const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({
  collaboratorIds,
  friends,
  className,
  size = 'sm',
  maxVisible = 3,
}) => {
  if (!collaboratorIds || collaboratorIds.length === 0) return null;

  const sizeClasses = size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-xs';
  const visible = collaboratorIds.slice(0, maxVisible);
  const overflow = collaboratorIds.length - maxVisible;

  return (
    <AvatarGroup className={className}>
      {visible.map((name, index) => {
        const friend = friends.find(f => f.userId === name || f.id === name || f.name === name);
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        return (
          <Avatar
            key={index}
            className={cn(sizeClasses)}
            title={name}
          >
            {friend?.avatar && friend.avatar.startsWith('http') ? (
              <AvatarImage src={friend.avatar} alt={name} />
            ) : null}
            <AvatarFallback className="bg-muted text-muted-foreground font-bold">
              {friend?.avatar && !friend.avatar.startsWith('http') ? (
                <span className={size === 'sm' ? 'text-xs' : 'text-base'}>{friend.avatar}</span>
              ) : (
                initials
              )}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 && (
        <AvatarGroupCount className={cn(sizeClasses)}>
          +{overflow}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  );
};

export default CollaboratorAvatars;
