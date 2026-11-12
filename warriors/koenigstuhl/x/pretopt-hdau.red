;redcode-94x
;name Giant Pretzel 31
;author Steve Gunnell
;strategy Yeah, it's a scanner. 
;assert 1

BEGIN  	equ    	52086
STEP   	equ    	18097
LEN    	equ    	(top-ptr+4)
IMPNUM 	equ    	49153

ptr    	dat    	BEGIN   ,BEGIN+STEP
   	for    9
       	dat    	$0    	,$0
   	rof
start  	add.f  	step1  	,ptr
    for    1
       	sne.i  	*ptr   	,@ptr
       	add.f  	step2  	,ptr
    rof
       	jmz.f  	start  	,*ptr
       	slt.ab 	ptr    	,#LEN
wipe   	mov.i  	bomb   	,*ptr
       	add.f  	step1  	,ptr
       	jmn.f  	wipe   	,*ptr
       	djn.b  	start  	,#36283
       	jmp    	start   ,}wipe
    for    7
       	dat    	$0    	,$0
    rof
step1  	dat    	#STEP  	,#STEP
step2  	dat    	#STEP*2	,#STEP*2
    for    2
       	dat    	$0    	,$0
    rof
bomb   	mov.i #1, <1
top    	dat    	$0    	,$0

END start
