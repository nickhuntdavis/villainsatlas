import React, { useState, useEffect, useRef } from 'react';
import { X, Bold, Italic, Underline, Trash2 } from 'lucide-react';
import { PrimaryButton } from '../ui/atoms';
import { typography, getThemeColors, fontFamily } from '../ui/theme';
import { Comment } from '../types';

interface CommentModalProps {
  comment?: Comment | null; // null = add mode, Comment = edit mode
  onSave: (text: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
  theme: 'dark' | 'light';
}

export const CommentModal: React.FC<CommentModalProps> = ({
  comment,
  onSave,
  onDelete,
  onCancel,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const isEditMode = comment !== null && comment !== undefined;
  const [commentText, setCommentText] = useState(comment?.text || '');
  const editorRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const modalTitleId = `comment-modal-title-${comment ? 'edit' : 'new'}`;
  const modalDescriptionId = `comment-modal-description-${comment ? 'edit' : 'new'}`;

  // Focus management: focus the editor when modal opens
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && commentText) {
      editorRef.current.innerHTML = commentText;
    }
  }, []);

  const handleSave = () => {
    const text = editorRef.current?.innerHTML || '';
    if (text.trim()) {
      onSave(text);
    }
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      setCommentText(editorRef.current.innerHTML);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-[#010E36]/90 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        aria-describedby={modalDescriptionId}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onCancel();
          }
        }}
      >
        <div 
          ref={modalRef}
          className="max-w-2xl w-full bg-[#282C55] shadow-xl relative rounded-[32px] overflow-hidden my-8" 
          style={{ padding: '32px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 text-[#BAB2CF] hover:text-[#FDFEFF] transition-colors opacity-60 hover:opacity-100"
            aria-label="Close modal"
            title="Close"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>

          <h2 id={modalTitleId} className={`${fontFamily.heading} text-[#FDFEFF] text-2xl mb-6`}>
            {isEditMode ? 'Edit Comment' : 'Add Comment'}
          </h2>
          <p id={modalDescriptionId} className="sr-only">
            {isEditMode ? 'Edit your comment' : 'Add a new comment to this location'}
          </p>

          {/* Rich text formatting toolbar */}
          <div className="flex gap-2 mb-4 p-2 bg-[#1A1D3A] rounded-md border border-[#BAB2CF]/20">
            <button
              type="button"
              onClick={() => handleFormat('bold')}
              className="p-2 hover:bg-[#3A3F6B] rounded transition-colors"
              title="Bold"
              aria-label="Bold"
            >
              <Bold size={16} className="text-[#FDFEFF]" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('italic')}
              className="p-2 hover:bg-[#3A3F6B] rounded transition-colors"
              title="Italic"
              aria-label="Italic"
            >
              <Italic size={16} className="text-[#FDFEFF]" />
            </button>
            <button
              type="button"
              onClick={() => handleFormat('underline')}
              className="p-2 hover:bg-[#3A3F6B] rounded transition-colors"
              title="Underline"
              aria-label="Underline"
            >
              <Underline size={16} className="text-[#FDFEFF]" />
            </button>
          </div>

          {/* Rich text editor */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            className="w-full min-h-[200px] px-4 py-3 bg-[#1A1D3A] border border-[#BAB2CF]/20 rounded-md text-[#FDFEFF] focus:outline-none focus:border-[#FF5D88] focus:ring-1 focus:ring-[#FF5D88] mb-6"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6',
            }}
            suppressContentEditableWarning={true}
            aria-label="Comment text"
          />

          {/* Buttons */}
          <div className="flex gap-3">
            <PrimaryButton
              theme={theme}
              onClick={handleSave}
              className="flex-1"
            >
              {isEditMode ? 'Save Changes' : 'Add Comment'}
            </PrimaryButton>
            {isEditMode && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-3 rounded-md transition-colors bg-[#FF5D88] text-white hover:opacity-90 font-medium"
              >
                <Trash2 size={16} className="inline mr-2" />
                Remove Comment
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className={`px-6 py-3 rounded-md transition-colors ${colors.accent.bgHover} text-[#BAB2CF] hover:text-[#FDFEFF] border border-[#BAB2CF]/30 hover:border-[#BAB2CF]/50`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-[#010E36]/90 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-comment-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(false);
            }
          }}
        >
          <div 
            className="max-w-md w-full bg-[#282C55] shadow-xl relative rounded-[32px] overflow-hidden" 
            style={{ padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-comment-title" className={`${fontFamily.heading} text-[#FDFEFF] text-2xl mb-4`}>
              Delete Comment?
            </h2>
            <p className={`${typography.body.default} text-[#BAB2CF] mb-6`}>
              Are you sure you want to delete this comment? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 px-6 py-3 rounded-md transition-colors bg-[#FF5D88] text-white hover:opacity-90 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`flex-1 px-6 py-3 rounded-md transition-colors ${colors.accent.bgHover} text-[#BAB2CF] hover:text-[#FDFEFF] border border-[#BAB2CF]/30 hover:border-[#BAB2CF]/50`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

