import { BaseNode } from '@tracereactive/types';
import { ModelingCategory } from '../../categories';
import * as aq from 'arquero';

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function trainLogistic(
    X: number[][],
    y: number[],
    numSteps: number,
    learningRate: number,
    l2: number
): number[] {
    const n = X.length;
    const d = X[0].length + 1; // +1 for bias
    const w = new Array(d).fill(0);

    for (let step = 0; step < numSteps; step++) {
        const grad = new Array(d).fill(0);
        for (let i = 0; i < n; i++) {
            const z = w[0] + X[i].reduce((s, xi, j) => s + xi * w[j + 1], 0);
            const err = sigmoid(z) - y[i];
            grad[0] += err;
            for (let j = 0; j < X[i].length; j++) grad[j + 1] += err * X[i][j];
        }
        w[0] -= learningRate * grad[0] / n;
        for (let j = 1; j < d; j++) {
            w[j] -= learningRate * (grad[j] / n + l2 * w[j]);
        }
    }
    return w;
}

function predictProba(X: number[][], w: number[]): number[] {
    return X.map(row => {
        const z = w[0] + row.reduce((s, xi, j) => s + xi * w[j + 1], 0);
        return sigmoid(z);
    });
}

export class LogisticRegressionNode extends BaseNode {
    readonly category = ModelingCategory;
    readonly typeId = 'stats:logistic_regression';
    readonly displayName = 'Logistic Regression';
    readonly visible = true;

    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];

    readonly outputs = [
        { name: 'Metrics', outputType: 'core:dataframe' },
        { name: 'Coefficients', outputType: 'core:dataframe' },
        { name: 'Fitted Data', outputType: 'core:dataframe' },
        { name: 'Accuracy', outputType: 'core:number' },
        { name: 'Model', outputType: 'core:data' }
    ];

    readonly properties = [
        { name: 'target', label: 'Target Column', type: 'text' as const, defaultValue: '' },
        { name: 'features', label: 'Feature Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'threshold', label: 'Decision Threshold', type: 'number' as const, defaultValue: 0.5 },
        { name: 'numSteps', label: 'Training Steps', type: 'number' as const, defaultValue: 1000 },
        { name: 'learningRate', label: 'Learning Rate', type: 'number' as const, defaultValue: 0.1 },
        { name: 'l2', label: 'L2 Regularisation', type: 'number' as const, defaultValue: 0.01 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const target = properties['target'] as string;
        const featureStr = properties['features'] as string;
        const threshold = Math.max(0, Math.min(1, Number(properties['threshold']) || 0.5));
        const numSteps = Math.max(100, Number(properties['numSteps']) || 1000);
        const learningRate = Number(properties['learningRate']) || 0.1;
        const l2 = Math.max(0, Number(properties['l2']) || 0.01);

        if (!target || !featureStr || !table.columnNames().includes(target)) return {};

        const features = featureStr.split(',').map(f => f.trim()).filter(f => table.columnNames().includes(f));
        if (features.length === 0) return {};

        // Auto-encode binary target (handles '0'/'1', 'yes'/'no', 'true'/'false', etc.)
        const rawTargets = Array.from(table.array(target));
        const uniqueLabels = [...new Set(rawTargets.filter(v => v != null).map(v => String(v)))].sort();
        if (uniqueLabels.length !== 2) return {};
        const labelMap: Record<string, number> = { [uniqueLabels[0]]: 0, [uniqueLabels[1]]: 1 };

        const X: number[][] = [];
        const y: number[] = [];

        const numRows = table.numRows();
        for (let r = 0; r < numRows; r++) {
            const rawY = rawTargets[r];
            if (rawY == null) continue;

            let rowX: number[] = [];
            let isValid = true;
            for (const f of features) {
                const val = Number(table.get(f, r));
                if (isNaN(val)) { isValid = false; break; }
                rowX.push(val);
            }
            if (isValid) {
                X.push(rowX);
                y.push(labelMap[String(rawY)]);
            }
        }

        if (X.length < 2 || !y.includes(0) || !y.includes(1)) return {};

        try {
            const weights = trainLogistic(X, y, numSteps, learningRate, l2);
            const probabilities = predictProba(X, weights);
            const predicted = probabilities.map(p => p >= threshold ? 1 : 0);

            let tp = 0, tn = 0, fp = 0, fn = 0;
            for (let i = 0; i < y.length; i++) {
                if (y[i] === 1 && predicted[i] === 1) tp++;
                else if (y[i] === 0 && predicted[i] === 0) tn++;
                else if (y[i] === 0 && predicted[i] === 1) fp++;
                else fn++;
            }

            const accuracy = (tp + tn) / y.length;
            const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
            const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
            const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);

            const eps = 1e-15;
            const logLoss = -y.reduce((sum, yi, i) => {
                const p = Math.max(eps, Math.min(1 - eps, probabilities[i]));
                return sum + yi * Math.log(p) + (1 - yi) * Math.log(1 - p);
            }, 0) / y.length;

            const metricsRows = [
                { Metric: 'Accuracy', Value: accuracy },
                { Metric: 'Precision', Value: precision },
                { Metric: 'Recall', Value: recall },
                { Metric: 'F1 Score', Value: f1 },
                { Metric: 'Log-Loss', Value: logLoss },
                { Metric: 'TP', Value: tp },
                { Metric: 'TN', Value: tn },
                { Metric: 'FP', Value: fp },
                { Metric: 'FN', Value: fn }
            ];

            const fittedObj: Record<string, any[]> = {};
            for (let i = 0; i < features.length; i++) {
                fittedObj[features[i]] = X.map(r => r[i]);
            }
            fittedObj['y_true'] = y;
            fittedObj['y_true_label'] = y.map(v => uniqueLabels[v]);
            fittedObj['probability'] = probabilities;
            fittedObj['predicted'] = predicted;
            fittedObj['predicted_label'] = predicted.map(v => uniqueLabels[v]);

            const coefRows = [
                { Term: '(intercept)', Weight: weights[0] },
                ...features.map((f, i) => ({ Term: f, Weight: weights[i + 1] }))
            ];

            return {
                Metrics: aq.from(metricsRows),
                Coefficients: aq.from(coefRows),
                'Fitted Data': aq.table(fittedObj),
                Accuracy: accuracy,
                Model: { type: 'logistic-gd', weights, features, target, labelMap, threshold }
            };
        } catch (e) {
            console.error(e);
            return {};
        }
    }
}
