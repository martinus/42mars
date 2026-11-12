;redcode-94x
;name Fractal AX 94
;author Steve Gunnell
;strategy Evolved from random opcodes and symbolic fields
;assert CORESIZE==55440

CORE0	equ	54430
CORE1	equ	38967
CORE2	equ	52286
CORE3	equ	46610
GATE0	equ	(L00-1-15)
GATE1	equ	(L00-1-11)
JUMP0	equ L14
JUMP1	equ L05
GAP  	equ	7

L00		MOV.I  $ -2, $ CORE0
L01		SPL.F  # L00+CORE1, $ 0
L02		DJN.F  # JUMP0, { CORE2
L03		DAT.F  $ 0, $ 0
L04		DAT.F  $ 0, $ 0
L05		DAT.F  $ 0, $ 0
L06		DAT.F  $ 0, $ 0
L07		DAT.F  $ 0, $ 0
L08		DAT.F  $ 0, $ 0
L09		DAT.F  $ 0, $ 0
L10		DAT.F  $ 0, $ 0
L11		DAT.F  $ 0, $ 0
L12		DAT.F  $ 0, $ 0
L13		DAT.F  $ 0, $ 0
L14		DAT.F  $ 0, $ 0
L15		DAT.F  $ 0, $ 0

	end	L00

