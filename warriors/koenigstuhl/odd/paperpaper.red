;redcode
;name Paper(Paper)
;author Sascha Zapf
;First entry for the 14th rd. of the IRCT.
;Paper
;       CORESIZE==800
;assert 1

stepone EQU 49
steptwo EQU 688
b1		EQU	644
b2		EQU 523
idec1	EQU 269
idec2	EQU 267
sgate1	EQU	239
sgate2	EQU 222

start:
qbomb	for 10
			mov.i	<50+(34*qbomb),60+(78*qbomb)
		rof
launch	spl	1,	<sgate1
		spl	1,	<sgate2
		mov.i	-1,0

silk	spl		stepone,	#0
		mov.i	>silk,	}silk
		mov.i	bomb,	{b1
		mov.i	bomb,	<b2
		add.a	#steptwo,silk
		jmp		silk,<silk
bomb	dat		<-idec1,<idec2

		end start
