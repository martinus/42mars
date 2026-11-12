;redcode
;name The the
;author Sascha Zapf
;assert CORESIZE==8000
;strategy Anti DJN Stream imps + 50% imp gate + Anti DJN-stream decoy

start	spl	imp
		spl imp
        spl	imp
        spl imp
        spl	1
        spl 1
        spl	#0,	<-10
        spl imp
        jmp	-1,	<-12

for 10
		dat	1,1
rof

imp		mov.i #1,1

		end start
        
        
