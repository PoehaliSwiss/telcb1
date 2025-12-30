import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { clsx } from 'clsx';

interface HintProps {
    title?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export const Hint: React.FC<HintProps> = ({ title = "Hint", children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="my-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    "border shadow-sm hover:shadow-md",
                    isOpen
                        ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-amber-900/20 dark:hover:border-amber-700 dark:hover:text-amber-400"
                )}
            >
                <Lightbulb size={16} />
                <span>{isOpen ? "Hide" : "Show"}: {title}</span>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {isOpen && (
                <div className="mt-2 ml-4 pl-4 border-l-2 border-amber-200 dark:border-amber-700">
                    <div className="text-gray-700 dark:text-gray-300">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};
