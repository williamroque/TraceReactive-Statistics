import { BaseNode } from '@tracereactive/types';
import { TimeSeriesCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class RollingStatsNode extends BaseNode {
    readonly category = TimeSeriesCategory;
    readonly typeId = 'stats:rolling';
    readonly displayName = 'Rolling Stats';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Data', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'window', label: 'Window Size', type: 'number' as const, defaultValue: 3 },
        { name: 'metric', label: 'Metric', type: 'select' as const, options: ['mean', 'std', 'min', 'max', 'ema'], defaultValue: 'mean' },
        { name: 'center', label: 'Center Window', type: 'boolean' as const, defaultValue: false }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        let cols = (properties['columns'] as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length === 0) {
            cols = table.columnNames().filter(c => typeof table.get(c, 0) === 'number');
        }
        
        let win = Number(properties['window']);
        if (isNaN(win) || win < 1) win = 3;
        
        const metric = properties['metric'] as string;
        const center = !!properties['center'];
        
        const offset = center ? Math.floor(win / 2) : win - 1;
        
        const derivations: Record<string, any> = {};
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>);
            const out = new Array(arr.length).fill(null);
            
            if (metric === 'ema') {
                const k = 2 / (win + 1);
                let ema = arr[0];
                out[0] = ema;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i] == null || isNaN(arr[i])) {
                        out[i] = out[i-1];
                    } else {
                        ema = arr[i] * k + ema * (1 - k);
                        out[i] = ema;
                    }
                }
            } else {
                for (let i = 0; i < arr.length; i++) {
                    const start = i - offset + (center ? 0 : 0);
                    const end = start + win;
                    if (start < 0 || end > arr.length) continue;
                    
                    const slice = arr.slice(start, end).filter(v => typeof v === 'number' && !isNaN(v));
                    if (slice.length === 0) continue;
                    
                    if (metric === 'mean') out[i] = ss.mean(slice);
                    else if (metric === 'std') out[i] = slice.length > 1 ? ss.standardDeviation(slice) : 0;
                    else if (metric === 'min') out[i] = ss.min(slice);
                    else if (metric === 'max') out[i] = ss.max(slice);
                }
            }
            derivations[`${col}_rolling`] = out;
        }
        
        let newTable = table;
        for (const [k, v] of Object.entries(derivations)) {
            newTable = newTable.assign({ [k]: v });
        }
        
        return { Data: newTable };
    }
}
