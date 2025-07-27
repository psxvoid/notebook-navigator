import React from 'react';

// This file tests that dependencies are properly respected when reorganizing

const helper1 = (value: string) => value.toUpperCase();

const CONFIG = {
    prefix: 'test_',
    suffix: '_end'
};

// This depends on helper1 and CONFIG
const helper2 = (input: string) => {
    return CONFIG.prefix + helper1(input) + CONFIG.suffix;
};

// This depends on helper2
const helper3 = (items: string[]) => {
    return items.map(helper2);
};

function processData(data: any) {
    return helper3(data.items || []);
}

const useCustomHook = () => {
    const [data, setData] = React.useState<{ items: string[] } | null>(null);

    const processed = React.useMemo(() => {
        return data ? processData(data) : [];
    }, [data]);

    return { data, setData, processed };
};

// Component that uses the helpers
const MyComponent: React.FC = () => {
    const { data, setData, processed } = useCustomHook();

    const handleClick = () => {
        setData({ items: ['test1', 'test2'] });
    };

    return (
        <div>
            <button onClick={handleClick}>Load Data</button>
            {processed.map((item, i) => (
                <div key={i}>{item}</div>
            ))}
        </div>
    );
};

export default MyComponent;
