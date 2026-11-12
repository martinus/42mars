;redcode-94x
;name Luna AX 221
;author Steve Gunnell
;strategy Evolved from Markov chains of opcodes and symbolic fields
;strategy This one is another paper. 
;assert CORESIZE==55440

CORE0	equ	3478
CORE1	equ	38733
GATE0	equ	(L00-9)
GATE1	equ	(L00-28)
GAP  	equ	13
IMPNUM	equ 29179
SAFE	equ (L19-GATE0+GAP+0)

L00		SPL.F	$ L15, < (CORE1*23466)
L01		SPL.F	$ 1, < (CORE1*34125)
L02		SPL.F	$ 1, < (CORE1*44784)
L03		SPL.F	$ 1, < (CORE1*3)
L04		SPL.F	$ (CORE1*2304), $ 0
L05		MOV.I	> -1, } -1
L06		SPL.F	@ 0, $ (CORE1*7752)
L07		MOV.I	} -1, > -1
L08		SPL.F	@ 0, } (CORE1*6824)
L09		MOV.I	} -1, > -1
L10		MOV.I	{ -2, < 1
L11		JMP.F	@ 0, > (CORE1*14510)
L12		DAT.F	> (CORE1*3925), > (CORE1*13480)
L13		MOV.I	$ L14, $ 1
L14		DAT.F	$ 0, $ 0
L15		DJN.B	# 0, # 0
L16		DAT.F	$ 0, $ 0
L17		DAT.F	< (CORE1*50893), $ (2+CORE0)
L18		SPL.F	# CORE0, { L18
L19		jmp  0, }0

	end	L01

