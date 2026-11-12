;redcode
;ICWS 86
;name FREEZER5
;author Marco Pontello 
;marcopontello@bigfoot.com
;assert 1

	SPL	0
	MOV	4, <5
	MOV	-2, <4
	DJN	-2, 3
	MOV	2, <-4
	JMP	-1
	DAT	#-8
Start	MOV	-7, 4993
	MOV	-7, 4993
	MOV	-7, 4993
	MOV	-7, 4993
	MOV	-7, 4993
	MOV	-7, 4993
	MOV	-7, 4993
	JMP	4987

        END     Start

