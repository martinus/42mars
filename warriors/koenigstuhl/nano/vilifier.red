;redcode-nano
;name Vilifier
;author Steve Gunnell
;strategy Evolved from markov chained opcodes and random fields
;strategy Form SPL MOV SPL MOV DJN
;originalname Azure nano vyfe
;assert CORESIZE==80

GATE	equ	(L00-4)
IMP	equ	37

L00	SPL.F	#0	,>IMP*2
L01	MOV.I	}-1	,}0 - (-1)
L02	SPL.F	<54/2	,<IMP+1
L03	MOV.I	*IMP+1	,<-3
L04	DJN.F	$-1	,<0-IMP

	end	L00

