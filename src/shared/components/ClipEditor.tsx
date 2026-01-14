import { MinimalClipEditor } from './MinimalClipEditor';

interface CommentEditorProps {
  url: string;
  initialComment: string;
  onSave?: () => void;
  showViewCommentsButton?: boolean;
  showSidebarButton?: boolean;
  showPopupButton?: boolean;
  onOpenPopup?: () => void | Promise<void>;
  isPopupPending?: boolean;
}

export function CommentEditor({
  url,
  initialComment: _initialComment,
  onSave,
  showViewCommentsButton = false,
  showSidebarButton = false,
  showPopupButton = false,
  onOpenPopup,
  isPopupPending = false
}: CommentEditorProps) {
  return (
    <MinimalClipEditor
      url={url}
      showViewCommentsButton={showViewCommentsButton}
      showSidebarButton={showSidebarButton}
      showPopupButton={showPopupButton}
      onOpenPopup={onOpenPopup}
      isPopupPending={isPopupPending}
      onCommentAdded={() => onSave?.()}
    />
  );
}
