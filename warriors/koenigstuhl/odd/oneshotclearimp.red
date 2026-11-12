;redcode
;name Onshot(Clear(Imp))
;author Sascha Zapf
;       CORESIZE==800
;assert 1
;Second entry of the IRCT#14

step EQU 184
fscan EQU 126
dstream EQU 646
inkr EQU 87


start	add.ab	#step,scan
scan	jmz.f	start,#fscan
		sub.ab	#step/2,scan
		spl		#0,<-267
		mov.i	bomb,>scan
		djn.b	-1, <dstream
		mov.i	0,3
		mov.i	0,3
		mov.i	0,3
bomb	dat		<inkr,-10

		end start
