// Export utility functions
export { cn } from './lib/utils';

// Form Components (Group A)
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';
export { Input } from './components/input';
export type { InputProps } from './components/input';
export { Textarea } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { Label } from './components/label';
export { Checkbox } from './components/checkbox';
export { RadioGroup, RadioGroupItem } from './components/radio-group';
export { Switch } from './components/switch';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './components/select';

// Layout Components (Group B)
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/card';
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog';
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './components/sheet';
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/accordion';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs';

// Feedback Components (Group C)
export { Alert, AlertTitle, AlertDescription } from './components/alert';
export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from './components/toast';
export { Badge, badgeVariants } from './components/badge';
export type { BadgeProps } from './components/badge';
export { Progress } from './components/progress';
export { Skeleton } from './components/skeleton';

// Navigation & Display Components (Group D)
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './components/dropdown-menu';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/tooltip';
export { Popover, PopoverTrigger, PopoverContent } from './components/popover';
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar';
export { LoadingSpinner, spinnerVariants } from './components/loading-spinner';
export type { LoadingSpinnerProps } from './components/loading-spinner';
