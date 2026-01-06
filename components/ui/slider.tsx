"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SliderProps {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onValueChange?: (value: number[]) => void
  className?: string
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ 
    className, 
    value, 
    defaultValue = [0], 
    min = 0, 
    max = 100, 
    step = 1, 
    disabled = false,
    onValueChange,
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = value ?? internalValue
    const percentage = ((currentValue[0] - min) / (max - min)) * 100
    
    const sliderRef = React.useRef<HTMLDivElement>(null)
    
    const updateValue = React.useCallback((clientX: number) => {
      if (disabled || !sliderRef.current) return
      
      const rect = sliderRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(1, x / rect.width))
      const rawValue = min + percentage * (max - min)
      const steppedValue = Math.round(rawValue / step) * step
      const clampedValue = Math.max(min, Math.min(max, steppedValue))
      
      const newValue = [clampedValue]
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }, [disabled, min, max, step, onValueChange])
    
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      if (disabled) return
      
      updateValue(e.clientX)
      
      const handleMouseMove = (e: MouseEvent) => {
        updateValue(e.clientX)
      }
      
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
      
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }, [disabled, updateValue])
    
    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
      if (disabled) return
      
      updateValue(e.touches[0].clientX)
      
      const handleTouchMove = (e: TouchEvent) => {
        updateValue(e.touches[0].clientX)
      }
      
      const handleTouchEnd = () => {
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
      
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleTouchEnd)
    }, [disabled, updateValue])
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <div
          ref={sliderRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-700 cursor-pointer"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div 
            className="absolute h-full bg-cyan-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className={cn(
            "absolute block h-5 w-5 rounded-full border-2 border-cyan-500 bg-white shadow transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2",
            disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
          )}
          style={{ 
            left: `calc(${percentage}% - 10px)`,
            top: '50%',
            transform: 'translateY(-50%)'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }

