;redcode-94x
;name Redspawn0 baadk 12
;author Redspawn0 / Steve Gunnell
;strategy Redcode generator using markov chains.
;strategy Generate command in 3 stages from previous command.
;assert 1

BOMB0	equ	L09
CORE0	equ	20878
GAP	equ	0
GATEA0	equ	L00-1-10
JUMP0	equ	L07
JUMP1	equ	L07
REF0	equ	L03
REF1	equ	L03
REF2	equ	L00
STEP0	equ	L06

L00  	MOV.AB	#(CORE0*1),	#(CORE0*1)
L01  	ADD.F	$STEP0,	$1
L02  	SNE.I	}(CORE0*9862),	$(CORE0*9862)-GAP
L03  	DJN.F	$JUMP0,	<(CORE0*50302)
L04  	MOV.B	$REF1,	@REF2
L05  	DJN.B	{REF0,	#(CORE0*45)
L06  	SPL.F	#(CORE0*4927),	$(CORE0*4927)
L07  	MOV.I	$BOMB0,	>GATEA0
L08  	DJN.F	$JUMP1,	>GATEA0
L09  	DAT.F	<1,	$(CORE0*14)
	end L01
