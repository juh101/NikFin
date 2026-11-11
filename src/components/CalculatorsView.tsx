
"use client"

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SIPCalculator } from './calculators/SIPCalculator';
import { LumpSumCalculator } from './calculators/LumpSumCalculator';
import { SWPCalculator } from './calculators/SWPCalculator';
import { RetirementCalculator } from './calculators/RetirementCalculator';
import { BucketStrategyCalculator } from './calculators/BucketStrategyCalculator';
import { Card } from '@/components/ui/card';

export function CalculatorsView() {
  return (
    <div className="space-y-6 overflow-y-auto custom-scrollbar no-scrollbar" style={{ maxHeight: 'calc(100dvh - 180px)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <Tabs defaultValue="sip" className="w-full">
        <div className="overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
          <TabsList className="flex w-max min-w-full h-11 bg-secondary/40 rounded-xl p-1 gap-1">
            <TabsTrigger value="sip" className="flex-1 text-[10px] font-bold uppercase min-w-[80px] whitespace-nowrap px-4">SIP</TabsTrigger>
            <TabsTrigger value="lump" className="flex-1 text-[10px] font-bold uppercase min-w-[80px] whitespace-nowrap px-4">Lump</TabsTrigger>
            <TabsTrigger value="swp" className="flex-1 text-[10px] font-bold uppercase min-w-[80px] whitespace-nowrap px-4">SWP</TabsTrigger>
            <TabsTrigger value="retire" className="flex-1 text-[10px] font-bold uppercase min-w-[80px] whitespace-nowrap px-4">Retire</TabsTrigger>
            <TabsTrigger value="bucket" className="flex-1 text-[10px] font-bold uppercase min-w-[80px] whitespace-nowrap px-4">Bucket</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="mt-6">
          <TabsContent value="sip" className="mt-0">
            <SIPCalculator />
          </TabsContent>
          <TabsContent value="lump" className="mt-0">
            <LumpSumCalculator />
          </TabsContent>
          <TabsContent value="swp" className="mt-0">
            <SWPCalculator />
          </TabsContent>
          <TabsContent value="retire" className="mt-0">
            <RetirementCalculator />
          </TabsContent>
          <TabsContent value="bucket" className="mt-0">
            <BucketStrategyCalculator />
          </TabsContent>
        </div>
      </Tabs>

      <Card className="p-4 bg-secondary/10 border-none rounded-2xl">
        <p className="text-[10px] text-muted-foreground text-center font-medium italic opacity-60 leading-relaxed">
          These calculations are estimates and do not constitute investment advice. Actual results may vary.
        </p>
      </Card>
    </div>
  );
}
