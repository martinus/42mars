;redcode-94x
;name Spray 'n Wipe Economy size 36
;author Steve Gunnell
;strategy More testing.
;assert 1

SIZE 	equ    	(tail-ptr+16)

ptr     dat    	0          	,#4360
        dat.f  	$0         ,$0
back    dat.f  	$0         ,$0
	for 0
        jmn.f  	#0         	,<ptr
	rof
spray   mov     wipe      	,>ptr
	for 4
        mov    	*spray     	,>ptr
	rof
        jmn.f  	spray      	,@ptr
scan    add.ab 	#4261	, ptr
        jmz.f  	scan       	,>ptr
        slt.b  	@scan     	,#SIZE
        jmp    	back+1     	,<ptr
        add.ab 	#SIZE      	,@scan
trip    mov.i  	comp       	, scan
        mov.i  	jump       	, trip
        spl    	scan       	,}spray
        mov    	tail       	,>1
        jmp    	-1         	, trip+1
	for 0
        dat.f 	$0        	,$0
	rof
wipe    spl    	#0         	,}0
	for 3
        spl    	#0         	,}0
	rof
	for 8
        dat.f 	$0        	,$0
	rof
comp    sne.i  	>ptr-scan  	,>ptr-scan
jump    jmp    	scan-trip  	,}spray-trip
tail    dat.f 	$0        	,$0
	
fDec  	equ  	(back-38002)

	for   (MAXLENGTH-CURLINE-8)
      	dat.f 	$0        	,$0
	rof

fBlur 	mov   	{fDec    	,<fDec+2   ; protection against qscan
      	mov   	{fDec+1  	,<fDec+4
      	mov   	{fDec+5  	,<fDec+7
      	mov   	{fDec+8  	,<fDec+12
      	mov   	{fDec+9  	,<fDec+14
      	mov   	{fDec+15 	,<fDec+17
      	mov   	{fDec+18 	,<fDec+19
      	jmp    	scan+1  	,>fDec+20

      	end   	fBlur
