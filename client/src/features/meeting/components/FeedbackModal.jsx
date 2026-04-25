import React, { useState } from 'react';
import { Star, X, MessageSquare } from 'lucide-react';
import { submitFeedback } from '@/services/api';
import toast from 'react-hot-toast';

export default function FeedbackModal({ meetingId, isOpen, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitFeedback({ meetingId, rating, comment });
      toast.success('Thank you for your feedback!');
      onClose();
    } catch (err) {
      toast.error('Failed to submit feedback');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md glass border border-dark-700 rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">How was your meeting?</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center">
              <p className="text-dark-300 text-sm mb-3">Rate your experience (required)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="p-1 transition-transform active:scale-90"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                  >
                    <Star
                      size={32}
                      className={
                        (hover || rating) >= star
                          ? 'fill-accent-500 text-accent-500'
                          : 'text-dark-600'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-dark-300 flex items-center gap-2">
                <MessageSquare size={14} />
                Any suggestions? (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts with us..."
                className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none h-24"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-dark-700 text-dark-300 hover:bg-dark-800 rounded-xl font-medium transition-all"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
