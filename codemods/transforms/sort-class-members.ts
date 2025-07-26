import { Transform } from 'jscodeshift';

const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // Find all class declarations
    root.find(j.ClassDeclaration).forEach(path => {
        const classBody = path.node.body;

        // Categorize class members
        const members = {
            staticProperties: [] as any[],
            staticMethods: [] as any[],
            properties: [] as any[],
            constructor: null as any,
            lifecycle: [] as any[],
            publicMethods: [] as any[],
            privateMethods: [] as any[],
            gettersSetters: [] as any[]
        };

        // Lifecycle method names for React components
        const lifecycleMethods = [
            'componentDidMount',
            'componentDidUpdate',
            'componentWillUnmount',
            'shouldComponentUpdate',
            'componentDidCatch',
            'getDerivedStateFromProps',
            'getSnapshotBeforeUpdate'
        ];

        classBody.body.forEach(member => {
            if (!member) return; // Skip null/undefined members

            if ((j.PropertyDefinition && j.PropertyDefinition.check(member)) || (j.ClassProperty && j.ClassProperty.check(member))) {
                if (member.static) {
                    members.staticProperties.push(member);
                } else {
                    members.properties.push(member);
                }
            } else if (j.MethodDefinition && j.MethodDefinition.check(member)) {
                const isPrivate = member.key.type === 'Identifier' && member.key.name.startsWith('_');
                const isLifecycle = member.key.type === 'Identifier' && lifecycleMethods.includes(member.key.name);

                if (member.key.type === 'Identifier' && member.key.name === 'constructor') {
                    members.constructor = member;
                } else if (member.kind === 'get' || member.kind === 'set') {
                    members.gettersSetters.push(member);
                } else if (member.static) {
                    members.staticMethods.push(member);
                } else if (isLifecycle) {
                    members.lifecycle.push(member);
                } else if (isPrivate) {
                    members.privateMethods.push(member);
                } else {
                    members.publicMethods.push(member);
                }
            }
        });

        // Sort methods within each category
        const sortMethods = (methods: any[]) => {
            return methods.sort((a, b) => {
                const aName = a.key.name || a.key.value || '';
                const bName = b.key.name || b.key.value || '';
                return aName.localeCompare(bName);
            });
        };

        // Sort lifecycle methods by their typical order
        const sortLifecycle = (methods: any[]) => {
            return methods.sort((a, b) => {
                const aIndex = lifecycleMethods.indexOf(a.key.name);
                const bIndex = lifecycleMethods.indexOf(b.key.name);
                return aIndex - bIndex;
            });
        };

        // Build organized class body
        const organizedBody: any[] = [];

        // Static properties first
        if (members.staticProperties.length > 0) {
            organizedBody.push(...sortMethods(members.staticProperties));
        }

        // Static methods
        if (members.staticMethods.length > 0) {
            organizedBody.push(...sortMethods(members.staticMethods));
        }

        // Instance properties
        if (members.properties.length > 0) {
            organizedBody.push(...sortMethods(members.properties));
        }

        // Constructor
        if (members.constructor) {
            organizedBody.push(members.constructor);
        }

        // Lifecycle methods
        if (members.lifecycle.length > 0) {
            organizedBody.push(...sortLifecycle(members.lifecycle));
        }

        // Getters and setters
        if (members.gettersSetters.length > 0) {
            organizedBody.push(...sortMethods(members.gettersSetters));
        }

        // Public methods
        if (members.publicMethods.length > 0) {
            organizedBody.push(...sortMethods(members.publicMethods));
        }

        // Private methods
        if (members.privateMethods.length > 0) {
            organizedBody.push(...sortMethods(members.privateMethods));
        }

        // Replace class body
        classBody.body = organizedBody;
    });

    return root.toSource({ quote: 'single', trailingComma: true });
};

export default transform;
