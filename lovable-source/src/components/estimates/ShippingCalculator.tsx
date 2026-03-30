import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Package, Plane } from 'lucide-react';

interface ShippingCalculatorProps {
  onTotalChange?: (total: number, breakdown: ShippingBreakdown) => void;
  className?: string;
}

export interface ShippingBreakdown {
  baseRate: number;
  overnightAddon: number;
  insuranceCost: number;
  hawaiiAlaskaSurcharge: number;
  saturdayDeliverySurcharge: number;
  total: number;
  isOvernightRequired: boolean;
  insuranceUnits: number;
  insuranceValue: number;
}

const BASE_RATE = 35;
const OVERNIGHT_ADDON = 25;
const INSURANCE_PER_UNIT = 1.50;
const INSURANCE_THRESHOLD_UNITS = 25;
const HAWAII_ALASKA_SURCHARGE = 30;
const SATURDAY_DELIVERY_SURCHARGE = 20;

export function ShippingCalculator({ onTotalChange, className }: ShippingCalculatorProps) {
  const [shippingMethod, setShippingMethod] = useState<'2day' | 'overnight'>('2day');
  const [insuranceUnits, setInsuranceUnits] = useState<number>(0);
  const [hawaiiAlaska, setHawaiiAlaska] = useState(false);
  const [saturdayDelivery, setSaturdayDelivery] = useState(false);

  // Determine if overnight is required based on insurance threshold
  const isOvernightRequired = insuranceUnits > INSURANCE_THRESHOLD_UNITS;

  // Auto-select overnight when threshold exceeded
  useEffect(() => {
    if (isOvernightRequired && shippingMethod !== 'overnight') {
      setShippingMethod('overnight');
    }
  }, [isOvernightRequired, shippingMethod]);

  // Calculate breakdown
  const breakdown = useMemo<ShippingBreakdown>(() => {
    const isOvernight = shippingMethod === 'overnight' || isOvernightRequired;
    const overnightAddon = isOvernight ? OVERNIGHT_ADDON : 0;
    const insuranceCost = insuranceUnits * INSURANCE_PER_UNIT;
    const hawaiiAlaskaSurcharge = hawaiiAlaska ? HAWAII_ALASKA_SURCHARGE : 0;
    const saturdayDeliverySurcharge = saturdayDelivery ? SATURDAY_DELIVERY_SURCHARGE : 0;
    const total = BASE_RATE + overnightAddon + insuranceCost + hawaiiAlaskaSurcharge + saturdayDeliverySurcharge;

    return {
      baseRate: BASE_RATE,
      overnightAddon,
      insuranceCost,
      hawaiiAlaskaSurcharge,
      saturdayDeliverySurcharge,
      total,
      isOvernightRequired,
      insuranceUnits,
      insuranceValue: insuranceUnits * 1000,
    };
  }, [shippingMethod, insuranceUnits, hawaiiAlaska, saturdayDelivery, isOvernightRequired]);

  // Notify parent of total change
  useEffect(() => {
    onTotalChange?.(breakdown.total, breakdown);
  }, [breakdown, onTotalChange]);

  const handleInsuranceChange = (value: string) => {
    const parsed = parseInt(value, 10);
    setInsuranceUnits(isNaN(parsed) ? 0 : Math.max(0, parsed));
  };

  return (
    <div className={`p-4 bg-slate-50 rounded border border-slate-200 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-slate-600" />
        <h3 className="qbo-section-title">Shipping Calculator</h3>
      </div>

      {/* Shipping Method Selection */}
      <div className="mb-4">
        <Label className="text-sm text-slate-600 mb-2 block">Shipping Method</Label>
        <RadioGroup
          value={shippingMethod}
          onValueChange={(value) => {
            if (!isOvernightRequired || value === 'overnight') {
              setShippingMethod(value as '2day' | 'overnight');
            }
          }}
          className="flex flex-col gap-2"
        >
          <div className={`flex items-center gap-3 p-3 rounded border ${
            shippingMethod === '2day' 
              ? 'border-primary bg-primary/5' 
              : 'border-slate-200 bg-white'
          } ${isOvernightRequired ? 'opacity-50' : ''}`}>
            <RadioGroupItem 
              value="2day" 
              id="shipping-2day" 
              disabled={isOvernightRequired}
            />
            <div className="flex-1">
              <Label 
                htmlFor="shipping-2day" 
                className={`font-medium cursor-pointer ${isOvernightRequired ? 'cursor-not-allowed' : ''}`}
              >
                FedEx 2 Day
              </Label>
              <p className="text-xs text-slate-500">Standard delivery (2 business days)</p>
            </div>
            <span className="text-sm font-semibold text-slate-700">${BASE_RATE.toFixed(2)}</span>
          </div>

          <div className={`flex items-center gap-3 p-3 rounded border ${
            shippingMethod === 'overnight' 
              ? 'border-primary bg-primary/5' 
              : 'border-slate-200 bg-white'
          } ${isOvernightRequired ? 'ring-2 ring-warning/50' : ''}`}>
            <RadioGroupItem value="overnight" id="shipping-overnight" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="shipping-overnight" className="font-medium cursor-pointer">
                  FedEx Overnight
                </Label>
                {isOvernightRequired && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-warning/20 text-warning rounded-full">
                    <Plane className="h-3 w-3" />
                    Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Priority delivery (next business day)</p>
            </div>
            <span className="text-sm font-semibold text-slate-700">
              ${(BASE_RATE + OVERNIGHT_ADDON).toFixed(2)}
              <span className="text-xs text-slate-500 ml-1">(+${OVERNIGHT_ADDON})</span>
            </span>
          </div>
        </RadioGroup>
      </div>

      {/* Insurance Units Input */}
      <div className="mb-4">
        <Label htmlFor="insurance-units" className="text-sm text-slate-600 mb-2 block">
          Insurance Units <span className="text-xs text-slate-400">($1,000 per unit @ $1.50/unit)</span>
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="insurance-units"
            type="text"
            inputMode="numeric"
            value={insuranceUnits || ''}
            onChange={(e) => handleInsuranceChange(e.target.value)}
            placeholder="0"
            className="qbo-input w-24"
          />
          <span className="text-sm text-slate-600">
            = <span className="font-medium">${(insuranceUnits * 1000).toLocaleString()}</span> coverage
          </span>
          {breakdown.insuranceCost > 0 && (
            <span className="text-sm text-primary font-medium">
              +${breakdown.insuranceCost.toFixed(2)}
            </span>
          )}
        </div>
        
        {/* Overnight requirement notice */}
        {isOvernightRequired && (
          <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
            <span className="text-warning">
              Insurance over $25,000 requires Overnight shipping.
            </span>
          </div>
        )}
      </div>

      {/* Additional Surcharges */}
      <div className="mb-5">
        <Label className="text-sm text-slate-600 mb-2 block">Additional Surcharges</Label>
        <div className="flex flex-col gap-2">
          <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
            hawaiiAlaska ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
          }`}>
            <Checkbox
              checked={hawaiiAlaska}
              onCheckedChange={(checked) => setHawaiiAlaska(checked === true)}
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700">Hawaii / Alaska</span>
              <p className="text-xs text-slate-500">Remote location surcharge</p>
            </div>
            <span className="text-sm font-semibold text-slate-700">+${HAWAII_ALASKA_SURCHARGE.toFixed(2)}</span>
          </label>

          <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
            saturdayDelivery ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
          }`}>
            <Checkbox
              checked={saturdayDelivery}
              onCheckedChange={(checked) => setSaturdayDelivery(checked === true)}
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700">Saturday Delivery</span>
              <p className="text-xs text-slate-500">Weekend delivery option</p>
            </div>
            <span className="text-sm font-semibold text-slate-700">+${SATURDAY_DELIVERY_SURCHARGE.toFixed(2)}</span>
          </label>
        </div>
      </div>

      {/* Total Breakdown */}
      <div className="border-t border-slate-200 pt-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Base Rate (FedEx 2 Day)</span>
            <span>${breakdown.baseRate.toFixed(2)}</span>
          </div>
          {breakdown.overnightAddon > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Overnight Add-on</span>
              <span>+${breakdown.overnightAddon.toFixed(2)}</span>
            </div>
          )}
          {breakdown.insuranceCost > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Insurance ({insuranceUnits} units × $1.50)</span>
              <span>+${breakdown.insuranceCost.toFixed(2)}</span>
            </div>
          )}
          {breakdown.hawaiiAlaskaSurcharge > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Hawaii/Alaska</span>
              <span>+${breakdown.hawaiiAlaskaSurcharge.toFixed(2)}</span>
            </div>
          )}
          {breakdown.saturdayDeliverySurcharge > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Saturday Delivery</span>
              <span>+${breakdown.saturdayDeliverySurcharge.toFixed(2)}</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between mt-3 pt-3 border-t border-slate-300 text-base font-semibold">
          <span className="text-slate-900">Estimated Shipping Total</span>
          <span className="text-primary">${breakdown.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
