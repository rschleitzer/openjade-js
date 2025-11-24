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
export const giveUp = new MessageType0(MessageType.Severity.error, null, -1, 'cannot continue because of previous errors');
export const subdocGiveUp = new MessageType0(MessageType.Severity.error, null, -1, 'cannot continue with subdocument because of previous errors');
export const subdocLevel = new MessageType1(MessageType.Severity.error, null, -1, 'number of open subdocuments exceeds quantity specified for SUBDOC parameter in SGML declaration (%1)');
export const numberLength = new MessageType1(MessageType.Severity.error, null, -1, 'number token exceeds NAMELEN limit (%1)');
export const nameTokenLength = new MessageType1(MessageType.Severity.error, null, -1, 'name token exceeds NAMELEN limit (%1)');
export const nonSgmlCharacter = new MessageType1(MessageType.Severity.error, null, -1, 'non-SGML character number %1');
export const nameLength = new MessageType1(MessageType.Severity.error, null, -1, 'name exceeds NAMELEN limit (%1)');
export const endTagCharacter = new MessageType1(MessageType.Severity.error, null, -1, 'invalid character in end tag: %1');
export const endTagEntityEnd = new MessageType0(MessageType.Severity.error, null, -1, 'entity end in end tag');
export const unclosedEndTagShorttag = new MessageType0(MessageType.Severity.error, null, -1, 'unclosed end tag (shorttag feature required)');
export const endTagInvalidToken = new MessageType1(MessageType.Severity.error, null, -1, 'invalid token in end tag: %1');
export const emptyEndTag = new MessageType0(MessageType.Severity.warning, null, -1, 'empty end tag');
export const emptyStartTag = new MessageType0(MessageType.Severity.warning, null, -1, 'empty start tag');
export const emptyEndTagNoOpenElements = new MessageType0(MessageType.Severity.error, null, -1, 'empty end tag with no open elements');
export const emptyEndTagBaseDtd = new MessageType0(MessageType.Severity.error, null, -1, 'empty end tag not in base DTD');
export const emptyStartTagBaseDtd = new MessageType0(MessageType.Severity.error, null, -1, 'empty start tag not in base DTD');
export const elementNotFinished = new MessageType1(MessageType.Severity.error, null, -1, 'element %1 not finished');
export const elementEndTagNotFinished = new MessageType1(MessageType.Severity.error, null, -1, 'end tag for element %1 which is not finished');
export const taglen = new MessageType1(MessageType.Severity.error, null, -1, 'length of start tag exceeds TAGLEN limit (%1)');
export const noCurrentRank = new MessageType1(MessageType.Severity.error, null, -1, 'no current rank for %1');
export const startTagMissingName = new MessageType0(MessageType.Severity.error, null, -1, 'missing name in start tag');
export const endTagMissingName = new MessageType0(MessageType.Severity.error, null, -1, 'missing name in end tag');
export const startTagGroupNet = new MessageType0(MessageType.Severity.error, null, -1, 'NET delimiter in group start tag');
export const processingInstructionEntityEnd = new MessageType0(MessageType.Severity.error, null, -1, 'entity end in processing instruction');
export const processingInstructionLength = new MessageType1(MessageType.Severity.error, null, -1, 'processing instruction length exceeds PILEN limit (%1)');
export const processingInstructionClose = new MessageType0(MessageType.Severity.error, null, -1, 'missing processing instruction close');
export const piMissingName = new MessageType0(MessageType.Severity.warning, null, -1, 'processing instruction does not start with valid name');
