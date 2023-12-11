import { createLibraryLicenseInfos } from '../../src/utils/LicenseInfos';
import * as path from 'path';

const expectedResult =
    'Component: Angular Digest HUD digest-hud\n' +
    'Copyright: Copyright (c) 2015 Piotr Kaminski\n' +
    'License Text: The MIT License\n' +
    '\n' +
    'Copyright (c) 2010-2018 Google, Inc. http://angularjs.org\n' +
    '\n' +
    'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
    'of this software and associated documentation files (the "Software"), to deal\n' +
    'in the Software without restriction, including without limitation the rights\n' +
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n' +
    'copies of the Software, and to permit persons to whom the Software is\n' +
    'furnished to do so, subject to the following conditions:\n' +
    '\n' +
    'The above copyright notice and this permission notice shall be included in\n' +
    'all copies or substantial portions of the Software.\n' +
    '\n' +
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n' +
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n' +
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n' +
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n' +
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n' +
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n' +
    'THE SOFTWARE.\n' +
    '\n' +
    'Component: AngularJS angular-js\n' +
    'Copyright: Copyright (c) 2010-2020 Google LLC. http://angularjs.org\n' +
    'License Text: The MIT License\n' +
    '\n' +
    'Copyright (c) 2010-2020 Google LLC. http://angularjs.org\n' +
    '\n' +
    'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
    'of this software and associated documentation files (the "Software"), to deal\n' +
    'in the Software without restriction, including without limitation the rights\n' +
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n' +
    'copies of the Software, and to permit persons to whom the Software is\n' +
    'furnished to do so, subject to the following conditions:\n' +
    '\n' +
    'The above copyright notice and this permission notice shall be included in\n' +
    'all copies or substantial portions of the Software.\n' +
    '\n' +
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n' +
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n' +
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n' +
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n' +
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n' +
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n' +
    'THE SOFTWARE.\n' +
    '\n' +
    'Modifications of the proprietary software in your product for your own and reverse engineering to debug such modifications are hereby permitted to the extent that such software components are linked to program libraries under the GNU Lesser General Public License (LGPL). However, you may not pass on to third parties the knowledge gained from reverse engineering or debugging, the information gained from re-engineering or the modified software itself. Please note that any modification is at your own risk and any warranty for defects resulting from the modification is void. In addition, the product may not be suitable for the intended use. This provision takes precedence over all other contractual provisions between you and collaboration Factory AG, Arnulfstr. 34, 80335 München.\n' +
    'Component: AngularJS angular-sanitize\n' +
    'Copyright: Copyright (c) 2010-2020 Google LLC. http://angularjs.org\n' +
    'License Text: The MIT License\n' +
    '\n' +
    'Copyright (c) 2010-2020 Google LLC. http://angularjs.org\n' +
    '\n' +
    'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
    'of this software and associated documentation files (the "Software"), to deal\n' +
    'in the Software without restriction, including without limitation the rights\n' +
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n' +
    'copies of the Software, and to permit persons to whom the Software is\n' +
    'furnished to do so, subject to the following conditions:\n' +
    '\n' +
    'The above copyright notice and this permission notice shall be included in\n' +
    'all copies or substantial portions of the Software.\n' +
    '\n' +
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n' +
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n' +
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n' +
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n' +
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n' +
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n' +
    'THE SOFTWARE.\n' +
    '\n' +
    'Modifications of the proprietary software in your product for your own and reverse engineering to debug such modifications are hereby permitted to the extent that such software components are linked to program libraries under the GNU Lesser General Public License (LGPL). However, you may not pass on to third parties the knowledge gained from reverse engineering or debugging, the information gained from re-engineering or the modified software itself. Please note that any modification is at your own risk and any warranty for defects resulting from the modification is void. In addition, the product may not be suitable for the intended use. This provision takes precedence over all other contractual provisions between you and collaboration Factory AG, Arnulfstr. 34, 80335 München.\n' +
    'Component: AngularJS angular-animate\n' +
    'Copyright: Copyright (c) 2010-2020 Google, Inc.\n' +
    'License Text: The MIT License\n' +
    '\n' +
    'Copyright (c) 2010-2020 Google LLC. http://angularjs.org\n' +
    '\n' +
    'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
    'of this software and associated documentation files (the "Software"), to deal\n' +
    'in the Software without restriction, including without limitation the rights\n' +
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n' +
    'copies of the Software, and to permit persons to whom the Software is\n' +
    'furnished to do so, subject to the following conditions:\n' +
    '\n' +
    'The above copyright notice and this permission notice shall be included in\n' +
    'all copies or substantial portions of the Software.\n' +
    '\n' +
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n' +
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n' +
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n' +
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n' +
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n' +
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n' +
    'THE SOFTWARE.\n' +
    '\n';

describe('test if the license infos can be read and processed correctly', () => {
    test('license infos can be read', () => {
        let libraryLicenseInfos = createLibraryLicenseInfos(
            path.join(process.cwd(), 'test/utils')
        );
        expect(libraryLicenseInfos).toBe(expectedResult);
    });
});
