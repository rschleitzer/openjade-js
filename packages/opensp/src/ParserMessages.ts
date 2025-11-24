// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// Parser message types
// This is a stub implementation for now - full message definitions would come from ParserMessages.msg

import { MessageType0, MessageType1, MessageType } from './Message';

export const pass2Ee = new MessageType0(MessageType.Severity.error, null, -1, 'pass 2 error');
export const activeDocLink = new MessageType0(MessageType.Severity.error, null, -1, 'active document link');
export const sorryActiveDoctypes = new MessageType0(MessageType.Severity.error, null, -1, 'sorry, multiple active doctypes not supported');
export const linkActivateTooLate = new MessageType0(MessageType.Severity.warning, null, -1, 'link type activation too late');
export const defaultEntityInAttribute = new MessageType1(MessageType.Severity.warning, null, -1, 'default entity reference in attribute: %1');
export const unstableLpdParameterEntity = new MessageType1(MessageType.Severity.error, null, -1, 'unstable LPD parameter entity: %1');
export const unstableLpdGeneralEntity = new MessageType1(MessageType.Severity.error, null, -1, 'unstable LPD general entity: %1');
export const concurrentInstances = new MessageType1(MessageType.Severity.error, null, -1, 'too many concurrent instances: %1');
