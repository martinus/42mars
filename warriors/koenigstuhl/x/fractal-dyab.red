;redcode-94x
;name Fractal AX 155
;author Steve Gunnell
;strategy Evolved from random opcodes and symbolic fields
;assert CORESIZE==55440

CORE0	equ	18113
CORE1	equ	13096
CORE2	equ	19333
CORE3	equ	29306
GATE0	equ	(L00-1-6)
GATE1	equ	(L00-1-18)
JUMP0	equ L04
JUMP1	equ L13
GAP  	equ	24

L00		SPL.F  # 0, > L00+CORE3
L01		DJN.F  # JUMP0, < GATE1
L02		JMZ.F  $ JUMP0, $ CORE1
L03		JMP.F  $ JUMP0, $ L04
L04		SPL.F  # L00+CORE2, > 1
L05		LDP.AB  # CORE1, # 0
L06		STP.F  @ 1, } 1
L07		STP.AB  # L00+CORE0, # L00
L08		MOV.I  # 0, $ 1
L09		MOV.B  $ -2, @ L00+CORE1
L10		JMP.F  $ JUMP1, } L00+CORE2
L11		JMP.F  > JUMP1, $ GATE0
L12		MOV.I  < GATE1, < L08
L13		DAT.F  $ 0, < CORE3
L14		MOV.I  } L12, # 0
L15		MOV.B  $ CORE0, $ GATE0

	end	L00

