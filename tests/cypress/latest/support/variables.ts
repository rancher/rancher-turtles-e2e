import {isRancherManagerVersion} from '~/support/utils';

export const vars = {
  shortTimeout: 600000,
  fullTimeout: 1200000,
  version: isRancherManagerVersion('>=2.13')
    ? 'v1.32.9+rke2r1'
    : 'v1.32.9+rke2r1',
};
