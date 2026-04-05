import React from 'react';
import { Friend } from '@/modules/friends';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';

interface CollaboratorAvatarsProps {
  collaborators?: string[];
  friends: Friend[];
  className?: string;
  size?: 'sm' | 'md';
}

const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({ 
  collaborators, 
  friends, 
  className,
  size = 'sm'
}) => {
  if (!collaborators || collaborators.length === 0) return null;

    const sizeClasses = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';

  return (
    <div className={cn("flex items-center -space-x-2 overflow-hidden", className)}>
      {collaborators.map((name, index) => {
        const friend = friends.find(f => f.name === name || f.id === name);
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        return (
          <Avatar 
            key={index} 
            className={cn("border-2 border-background", sizeClasses)}
            title={name}
          >
            {friend?.avatar && friend.avatar.startsWith('http') ? (
              <AvatarImage src={friend.avatar} alt={name} />
            ) : null}
            <AvatarFallback className="bg-muted text-muted-foreground font-bold">
              {friend?.avatar && !friend.avatar.startsWith('http') ? (
                <span className={size === 'sm' ? "text-xs" : "text-base"}>{friend.avatar}</span>
              ) : (
                initials
              )}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
};

export default CollaboratorAvatars;
