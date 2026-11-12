;redcode-94x
;name Luna AX 104
;author Steve Gunnell
;strategy Evolved from Markov chains of opcodes and symbolic fields
;assert CORESIZE==55440

CORE0	equ	15262
CORE1	equ	6238
GATE0	equ	(L00-21)
GATE1	equ	(L00-0)
GAP  	equ	2
IMPNUM	equ 32191
SAFE	equ (L19-GATE0+GAP+4)

L00		SPL.F	$ L10, } (CORE1*350)
L01		SPL.F	$ L13, } (CORE1*350)
L02		SPL.F	$ 1, < (CORE1*350)
L03		SPL.F	$ 1, } (CORE1*350)
L04		SPL.F	$ 1, > (CORE1*350)
L05		SPL.F	@ 0, { (CORE1*33036)
L06		MOV.I	} -1, > -1
L07		SPL.F	@ 0, < (CORE1*23650)
L08		MOV.I	} -1, > -1
L09		SPL.F	@ 0, $ (CORE1*14)
L10		MOV.I	} -1, > -1
L11		MOV.I	{ -2, < 1
L12		JMP.F	@ 0, > (CORE1*49638)
L13		DAT.F	$ 0, $ 0
L14		MOV.I	< (CORE1*2528), { (CORE1*33486)
L15		MOV.I	< (CORE1*33486), { (CORE1*9004)
L16		MOV.I	< (CORE1*9004), { (CORE1*39962)
L17		DJN.F	$ L01, < (CORE1*1)
L18		DAT.F	$ 0, $ 0
L19		nop 0, {0

	end	L00

