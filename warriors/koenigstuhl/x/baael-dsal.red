;redcode-94x
;name Redspawn0 baael 11
;author Redspawn0 / Steve Gunnell
;strategy Redcode generator using markov chains.
;strategy Generate command in 3 stages from previous command.
;assert 1

BOMB0	equ	L03
BOMB1	equ	L02
BOMB2	equ	L08
BOMB3	equ	L11
CORE0	equ	25284
IMP  	equ	29179
JUMP0	equ	L12
JUMP2	equ	L04
JUMP3	equ	L03
JUMP4	equ	L09
REF2	equ	L05
REF3	equ	L05
REF4	equ	L01
REF5	equ	L03
REF6	equ	L03
REF7	equ	L03
STEP0	equ	L15

L00  	JMP.F	$JUMP0,	$0
L01  	ADD.A	#IMP,	$-1
L02  	DAT.F	$0,	$0
L03  	MOV.B	$REF2,	#(CORE0*28662)
L04  	MOV.I	$BOMB2,	>-1
L05  	ADD.AB	#(CORE0*12603),	#(CORE0*28662)
L06  	JMZ.F	$JUMP2,	@-1
L07  	JMN.B	$JUMP3,	*REF3
L08  	SPL.F	$0,	$0
L09  	MOV.I	$BOMB3,	>REF4
L10  	DJN.F	$JUMP4,	>REF4
L11  	DAT.F	$0,	$(CORE0*19787)
L12  	MOV.I	>(CORE0*7872),	$(CORE0*1233)
L13  	ADD.F	$STEP0,	$-1
L14  	JMP.F	$JUMP0,	<(CORE0*8782)
L15  	MOV.I	$BOMB0,	$(CORE0*52681)
L16  	MOV.I	$BOMB1,	<-1
L17  	SPL.F	@REF4,	<(CORE0*72)
L18  	SPL.F	$REF5,	<(CORE0*108)
L19  	SPL.F	$REF6,	<(CORE0*144)
L20  	SPL.F	$REF7,	<(CORE0*180)
	end L03
