;redcode-94x
;name Luna AX 130
;author Steve Gunnell
;strategy Evolved from Markov chains of opcodes and symbolic fields
;assert CORESIZE==55440

CORE0	equ	16453
CORE1	equ	35825
GATE0	equ	(L00-14)
GATE1	equ	(L00-28)
GAP  	equ	8
IMPNUM	equ 43523
SAFE	equ (L19-GATE0+GAP+2)

L00		SPL.F	$ L14, < (CORE1*23466)
L01		SPL.F	$ 1, < (CORE1*34125)
L02		SPL.F	$ 1, < (CORE1*44784)
L03		SPL.F	$ 1, < (CORE1*3)
L04		SPL.F	$ (CORE1*2304), $ 0
L05		MOV.I	> -1, } -1
L06		SPL.F	$ (CORE1*790), $ 0
L07		MOV.I	> -1, } -1
L08		SPL.F	@ 0, > (CORE1*11536)
L09		MOV.I	} -1, > -1
L10		MOV.I	{ -2, < 1
L11		DJN.F	@ 0, < (CORE1*672)
L12		MOV.I	# (CORE1*4648), } 1
L13		DAT.F	$ 0, $ 0
L14		MUL.B	* 2, $ L08
L15		SNE.I	< L16, @ L16-GAP
L16		ADD.B	$ L14, $ 2
L17		MOV.I	$ L13, @ 1
L18		JMP.F	$ L14, < (CORE1*18882)
L19		mod.x #1, #1

	end	L01

