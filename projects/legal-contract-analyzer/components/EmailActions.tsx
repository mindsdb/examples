'use client';

import { useState, useEffect } from 'react';
import { EmailAction } from '@/lib/types';
import { sendEmail, scheduleEmail } from '@/lib/email-api';
import { storage } from '@/lib/storage';
import { Mail, Calendar, Plus, X, Send, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailActionsProps {
    actions: EmailAction[];
    messageId?: string;
    onActionComplete: (actionLabel: string, actionType: string, result: any) => void;
}

interface EmailModalProps {
    action: EmailAction;
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipients: string[], scheduledTime?: Date) => void;
}

function EmailModal({ action, isOpen, onClose, onSend }: EmailModalProps) {
    const [recipients, setRecipients] = useState<string[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Safety check - don't render if action is null
    if (!action) {
        return null;
    }

    useEffect(() => {
        if (isOpen) {
            loadSavedEmails();

            // Initialize scheduled time from AI suggestion if available
            if (action.type === 'schedule' && (action.scheduledTime || (action as any).scheduled_datetime)) {
                try {
                    // Handle both property names (scheduledTime from interface, scheduled_datetime from AI)
                    let dateTimeValue = action.scheduledTime
                        ? (action.scheduledTime instanceof Date ? action.scheduledTime.toISOString() : action.scheduledTime)
                        : (action as any).scheduled_datetime;

                    // Convert AI format "2025-11-03 09:00" to datetime-local format "2025-11-03T09:00"
                    if (typeof dateTimeValue === 'string') {
                        if (dateTimeValue.includes(' ') && !dateTimeValue.includes('T')) {
                            dateTimeValue = dateTimeValue.replace(' ', 'T');
                        }
                    }

                    // Ensure the format is valid for datetime-local input
                    const date = new Date(dateTimeValue);
                    if (!isNaN(date.getTime())) {
                        // Format as YYYY-MM-DDTHH:MM for datetime-local input
                        const isoString = date.toISOString();
                        const localDateTime = isoString.slice(0, 16); // Remove seconds and timezone
                        setScheduledTime(localDateTime);
                    }
                } catch (error) {
                    console.warn('Failed to parse AI suggested datetime:', action.scheduledTime || (action as any).scheduled_datetime, error);
                }
            }
        }
    }, [isOpen, action]);

    useEffect(() => {
        if (action) {
            setIsValid(recipients.length > 0 && (action.type === 'send' || !!scheduledTime));
        }
    }, [recipients, scheduledTime, action]);

    const loadSavedEmails = async () => {
        try {
            const saved = await storage.getEmailRecipients();
            setRecipients(saved);
        } catch (error) {
            console.error('Failed to load emails:', error);
        }
    };

    const saveEmails = async (emails: string[]) => {
        try {
            await storage.saveEmailRecipients(emails);
        } catch (error) {
            console.error('Failed to save emails:', error);
        }
    };

    const addEmail = () => {
        const email = newEmail.trim();
        if (email && /\S+@\S+\.\S+/.test(email) && !recipients.includes(email)) {
            const updated = [...recipients, email];
            setRecipients(updated);
            saveEmails(updated);
            setNewEmail('');
        }
    };

    const removeEmail = (email: string) => {
        const updated = recipients.filter(e => e !== email);
        setRecipients(updated);
        saveEmails(updated);
    };

    const handleSend = async () => {
        setIsSending(true);
        try {
            const scheduledDate = scheduledTime ? new Date(scheduledTime) : undefined;
            await onSend(recipients, scheduledDate);
            onClose();
        } catch (error) {
            console.error('Failed to send email:', error);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSending) {
                    onClose();
                }
            }}
        >
            <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            {action.type === 'send' ? <Mail className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                            {action.label}
                        </h3>
                        <button
                            onClick={onClose}
                            disabled={isSending}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Recipients */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Recipients</label>
                        <div className="space-y-2">
                            {recipients.map(email => (
                                <div key={email} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 rounded px-3 py-2">
                                    <span className="text-sm">{email}</span>
                                    <button onClick={() => removeEmail(email)} className="text-red-500 hover:text-red-700">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                                    placeholder="Add email address"
                                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800"
                                />
                                <button
                                    onClick={addEmail}
                                    disabled={!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)}
                                    className="px-3 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Schedule Time */}
                    {action.type === 'schedule' && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Schedule Time</label>
                            <input
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800"
                            />
                        </div>
                    )}

                    {/* Subject & Body Preview */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Subject</label>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded text-sm">{action.subject}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Message</label>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded text-sm max-h-32 overflow-y-auto">
                            {action.body}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2 text-slate-300 hover:text-slate-400 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!isValid || isSending}
                        className={cn(
                            "px-4 py-2 rounded text-white flex items-center gap-2",
                            isValid && !isSending ? "bg-blue-500 hover:bg-blue-600" : "bg-slate-400 cursor-not-allowed"
                        )}
                    >
                        {isSending ? (
                            <>
                                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                {action.type === 'send' ? <Send className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                {action.type === 'send' ? 'Send Now' : 'Schedule'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function EmailActions({ actions, messageId, onActionComplete }: EmailActionsProps) {
    const [activeModal, setActiveModal] = useState<EmailAction | null>(null);

    // Initialize completed actions from localStorage if messageId is provided
    const [completedActions, setCompletedActions] = useState<Set<string>>(() => {
        if (messageId) {
            try {
                const completedKey = `completed_email_actions_${messageId}`;
                const storedCompleted = JSON.parse(localStorage.getItem(completedKey) || '[]');
                return new Set(storedCompleted);
            } catch (error) {
                console.error('Failed to load completed email actions:', error);
            }
        }
        // Fallback to checking action status
        return new Set(actions.filter(action => action.status === 'sent').map(action => action.label));
    });

    const [loadingActions, setLoadingActions] = useState<Set<string>>(() => {
        // Initialize from actions that have 'sending' status
        return new Set(actions.filter(action => action.status === 'sending').map(action => action.label));
    });

    // Update state when actions prop changes (e.g., after page refresh)
    useEffect(() => {
        if (messageId) {
            try {
                const completedKey = `completed_email_actions_${messageId}`;
                const storedCompleted = JSON.parse(localStorage.getItem(completedKey) || '[]');
                setCompletedActions(new Set(storedCompleted));
            } catch (error) {
                console.error('Failed to load completed email actions:', error);
                // Fallback to checking action status
                setCompletedActions(new Set(actions.filter(action => action.status === 'sent').map(action => action.label)));
            }
        } else {
            setCompletedActions(new Set(actions.filter(action => action.status === 'sent').map(action => action.label)));
        }
        setLoadingActions(new Set(actions.filter(action => action.status === 'sending').map(action => action.label)));
    }, [actions, messageId]);

    const handleActionClick = (action: EmailAction) => {
        setActiveModal(action);
    };

    const handleSend = async (recipients: string[], scheduledTime?: Date) => {
        if (!activeModal) return;

        // Set loading state
        setLoadingActions(prev => new Set(prev).add(activeModal.label));

        try {
            const payload = {
                recipients,
                subject: activeModal.subject,
                body: activeModal.body,
                ...(scheduledTime && { datetime: scheduledTime.toISOString() })
            };

            const result = activeModal.type === 'send'
                ? await sendEmail(payload)
                : await scheduleEmail(payload);

            setCompletedActions(prev => new Set(prev).add(activeModal.label));

            // Store completion in localStorage if messageId is provided
            if (messageId) {
                try {
                    const completedKey = `completed_email_actions_${messageId}`;
                    const existingCompleted = JSON.parse(localStorage.getItem(completedKey) || '[]');
                    if (!existingCompleted.includes(activeModal.label)) {
                        existingCompleted.push(activeModal.label);
                        localStorage.setItem(completedKey, JSON.stringify(existingCompleted));
                    }
                } catch (error) {
                    console.error('Failed to store completed email action:', error);
                }
            }

            onActionComplete(activeModal.label, activeModal.type, result);
        } catch (error) {
            console.error('Email action failed:', error);
            onActionComplete(activeModal.label, 'error', { error: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
            // Clear loading state
            setLoadingActions(prev => {
                const newSet = new Set(prev);
                newSet.delete(activeModal.label);
                return newSet;
            });
        }
    };

    if (!actions?.length) return null;

    return (
        <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action, index) => {
                const isCompleted = completedActions.has(action.label);
                const isLoading = loadingActions.has(action.label);
                const Icon = action.type === 'send' ? Mail : Calendar;

                return (
                    <button
                        key={index}
                        onClick={() => !isCompleted && !isLoading && handleActionClick(action)}
                        disabled={isCompleted || isLoading}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isCompleted
                                ? "bg-green-100 text-green-700 cursor-not-allowed"
                                : isLoading
                                    ? "bg-blue-100 text-blue-600 cursor-not-allowed"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                        )}
                    >
                        {isLoading ? (
                            <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Icon className="h-3 w-3" />
                        )}
                        {isCompleted ? (action.type === 'schedule' ? '✓ Scheduled' : '✓ Sent') : isLoading ? 'Sending...' : action.label}
                    </button>
                );
            })}

            {activeModal && (
                <EmailModal
                    action={activeModal}
                    isOpen={true}
                    onClose={() => setActiveModal(null)}
                    onSend={handleSend}
                />
            )}
        </div>
    );
}