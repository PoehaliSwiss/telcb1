import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useBlanks, getTextFromChildren, type BlankData, type BlankStatus } from './hooks/useBlanks';
import { useProgress } from '../../context/ProgressContext';
import { useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { generateStableExerciseId } from '../../utils/exerciseId';

interface InlineBlanksProps {
    children: React.ReactNode;
    mode?: 'type' | 'picker';
    options?: string[];
}

// Context to pass data to markdown components (for tables)
const InlineBlanksContext = React.createContext<{
    blanksData: BlankData[];
    inputs: string[];
    touched: boolean[];
    blurred: boolean[];
    handleBlur: (index: number) => void;
    renderBlank: (index: number, data: BlankData, status: BlankStatus) => React.ReactNode;
} | null>(null);

// Component to render a blank within markdown (for tables)
const InlineMarkdownBlank = ({ indexStr }: { indexStr: string }) => {
    const context = React.useContext(InlineBlanksContext);
    if (!context) return null;

    const { blanksData, inputs, touched, blurred, renderBlank } = context;
    const index = parseInt(indexStr);
    const data = blanksData[index];
    if (!data) return null;

    const value = inputs[index] || '';
    const isCorrect = value.trim().toLowerCase() === data.answer.toLowerCase();
    const showValidation = touched[index] && blurred[index] && value.trim() !== '';

    const status = {
        value,
        isCorrect,
        isWrong: showValidation && !isCorrect,
        touched: touched[index],
        showValidation
    };
    return <>{renderBlank(index, data, status)}</>;
};

// Stable components object for ReactMarkdown (tables)
const inlineMarkdownComponents = {
    span: (props: any) => {
        const indexStr = props['data-blank'];
        if (indexStr !== undefined) {
            return <InlineMarkdownBlank indexStr={indexStr} />;
        }
        return <span {...props} />;
    },
    p: ({ children }: any) => <span className="block mb-2">{children}</span>
};

export const InlineBlanks: React.FC<InlineBlanksProps> = ({ children, mode = 'type', options = [] }) => {
    const { markExerciseComplete, isExerciseComplete } = useProgress();
    const location = useLocation();
    const exerciseIdRef = useRef<string>('');
    const [isCompleted, setIsCompleted] = useState(false);

    // Generate exercise ID on mount
    useEffect(() => {
        const lessonPath = location.pathname;
        const childrenText = getTextFromChildren(children);
        const exerciseId = generateStableExerciseId(lessonPath, 'InlineBlanks', childrenText);
        exerciseIdRef.current = exerciseId;
        setIsCompleted(isExerciseComplete(exerciseId));
    }, [location.pathname, children, isExerciseComplete]);

    // Pre-process children: extract text and dedent for table detection
    const { rawText, isTable } = useMemo(() => {
        const text = getTextFromChildren(children);

        // Check if it's a markdown table
        const lines = text.split('\n');
        const hasPipes = lines.some(line => line.includes('|'));
        const hasSeparator = lines.some(line => /^\s*\|[\s\-:|]+\|\s*$/.test(line));
        const tableDetected = hasPipes && hasSeparator;

        if (tableDetected || text.includes('\n')) {
            const minIndent = lines.reduce((min, line) => {
                if (line.trim().length === 0) return min;
                const indent = line.match(/^\s*/)?.[0].length || 0;
                return Math.min(min, indent);
            }, Infinity);

            if (minIndent !== Infinity && minIndent > 0) {
                const dedented = lines.map(line => line.length >= minIndent ? line.slice(minIndent) : line).join('\n');
                return { rawText: dedented, isTable: tableDetected };
            }
            return { rawText: text, isTable: tableDetected };
        }
        return { rawText: text, isTable: false };
    }, [children]);

    // Pass original children to useBlanks so renderContent can preserve React elements like <strong>
    const {
        blanksData,
        inputs,
        handleInputChange,
        handleBlur,
        touched,
        blurred,
        revealAnswer,
        renderContent,
        allCorrect
    } = useBlanks({ children, mode, options });

    // Check completion when all correct
    useEffect(() => {
        if (allCorrect && exerciseIdRef.current && !isCompleted) {
            markExerciseComplete(exerciseIdRef.current, location.pathname);
            setIsCompleted(true);
        }
    }, [allCorrect, isCompleted, markExerciseComplete, location.pathname]);

    const renderBlank = useCallback((index: number, data: BlankData, status: BlankStatus) => {
        const { value } = status;
        const { answer, localOptions } = data;

        // Combine answer with options for the dropdown
        const currentOptions = localOptions.length > 0 ? localOptions : options;
        const dropdownOptions = Array.from(new Set([...currentOptions, answer])).sort();

        // Strict validation: only show if touched AND blurred
        const isCorrectRaw = value.trim().toLowerCase() === data.answer.toLowerCase();
        const shouldShowValidation = touched[index] && blurred[index] && value.trim() !== '';

        const isRight = shouldShowValidation && isCorrectRaw;
        const isWrongVal = shouldShowValidation && !isCorrectRaw;

        return (
            <span key={index} className="inline-flex items-center relative mx-1 align-middle">
                {mode === 'picker' ? (
                    <select
                        key={`inline-blank-select-${index}`}
                        value={value}
                        onChange={(e) => {
                            handleInputChange(index, e.target.value);
                        }}
                        onBlur={() => handleBlur(index)}
                        className={clsx(
                            "px-1 py-0.5 border-b-2 outline-none bg-transparent transition-colors text-center min-w-[60px] cursor-pointer appearance-none pr-4",
                            isRight ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20" :
                                isWrongVal ? "border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20" :
                                    "border-gray-300 focus:border-blue-500 dark:border-gray-600"
                        )}
                    >
                        <option value="" disabled>...</option>
                        {dropdownOptions.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        key={`inline-blank-input-${index}`}
                        type="text"
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                        value={value}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        onBlur={() => handleBlur(index)}
                        className={clsx(
                            "px-1 py-0.5 border-b-2 outline-none bg-transparent transition-colors text-center min-w-[40px]",
                            isRight ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20" :
                                isWrongVal ? "border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20" :
                                    "border-gray-300 focus:border-blue-500 dark:border-gray-600"
                        )}
                        style={{ width: `${Math.max(answer.length * 10 + 10, 40)}px` }}
                    />
                )}
                <button
                    onClick={() => revealAnswer(index)}
                    title={value === answer ? "Hide hint" : "Show hint"}
                    className="ml-0.5 p-0.5 text-gray-400 hover:text-yellow-500 transition-colors focus:outline-none"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                    </svg>
                </button>
                {data.hint && (touched[index] && value === data.answer) && (
                    <span className="ml-1 text-xs text-gray-500 italic animate-in fade-in whitespace-nowrap">
                        ({data.hint})
                    </span>
                )}
            </span>
        );
    }, [mode, inputs, handleInputChange, handleBlur, options, revealAnswer]);

    // For tables: process raw text to replace [answer] with placeholders, then use ReactMarkdown
    const processedMarkdown = useMemo(() => {
        if (!isTable) return '';
        const parts = rawText.split(/(\[.*?\])/g);
        let blankIndex = 0;
        return parts.map(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                const index = blankIndex++;
                return `<span data-blank="${index}"></span>`;
            }
            return part;
        }).join('');
    }, [isTable, rawText]);

    // Conditional rendering: ReactMarkdown for tables, renderContent for normal content
    let content;
    if (isTable) {
        content = (
            <InlineBlanksContext.Provider value={{ blanksData, inputs, touched, blurred, handleBlur, renderBlank }}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={inlineMarkdownComponents}
                >
                    {processedMarkdown}
                </ReactMarkdown>
            </InlineBlanksContext.Provider>
        );
    } else {
        // Use renderContent which preserves React elements like <strong>, <em>
        content = renderContent(renderBlank);
    }

    return (
        <div className="relative">
            {isCompleted && (
                <div className="absolute -top-3 -right-3 bg-green-500 text-white rounded-full p-2 shadow-lg z-10">
                    <Check size={20} />
                </div>
            )}
            <div className="leading-normal prose dark:prose-invert max-w-none">
                {content}
            </div>
        </div>
    );
};
