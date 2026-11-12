;redcode-94x
;name Eris AX 622
;author Steve Gunnell
;strategy Evolved from Markov chains of opcodes and symbolic fields
;assert CORESIZE==55440

CORE0	equ	37553
CORE1	equ	15353
CORE2	equ	38014
CORE3	equ	22033
GATE 	equ	(L00-0)
GAP  	equ	7
IMP   	equ 15439
SAFE	equ (L19-GATE+GAP+7)
BOOT	equ L18

L00		SPL.F	$ L00+CORE2, < L00+CORE3
L01		SPL.F	$ CORE1, < CORE2
L02		SPL.F	$ -CORE0, < -CORE1
L03		DAT.F	$ 0, $ 0
L04		SPL.F	$ 1, < L00+CORE3
L05		MOV.I	$ L06, $ 0
L06		SPL.F	$ 1, < -CORE1
L07		SPL.F	@ 0, > L00+CORE0
L08		MOV.I	} -1, > -1
L09		MOV.I	} -2, > -2
L10		SPL.F	@ 0, > -CORE1
L11		MOV.I	} -1, > -1
L12		MOV.I	} -2, > -2
L13		SPL.F	@ 0, { CORE2
L14		MOV.I	} -1, > -1
L15		MOV.I	{ -2, < 1
L16		JMP.F	@ 0, $ L00+CORE3
L17		MOD.X	< 0, > 0
L18		DAT.F	} -CORE0, > -CORE1
L19		MOV.I	# 0, $ 1

	end	L04

