;redcode-94x
;name Blitz AX 16
;author Steve Gunnell
;strategy Triple random papers
;assert 1

I13    	equ 34117
I19    	equ 29179
IMP		equ 32191

step   	equ 17211

start  	spl    p2
       	spl    1,    1
		mov -1,0
	spl  1,1
	spl  1,1
       	spl    4934 , 0
       	mov.i  >-1,    }-1
t1     	spl    @0,   step
       	mov.i  }-1,  >-1
       	mov.i  b1, >0+t1
   	for 6
       	mov.i  b1, >0-step-step-step+t1
   	rof
b1     	dat }IMP+IMP-1, }IMP

   	for 8
       	dat.f  $0, $0
   	rof

p2     	spl    p3
       	spl    1,    1
		spl  1,1
	spl  1,1
	spl  1,1
       	spl    29983 , 0
       	mov.i  >-1,    }-1
t2     	spl    @0,   step
       	mov.i  }-1,  >-1
       	mov.i  b2  , {0+step+t2
   	for 10
       	mov.i  b2  , <0-step-step-step+t2
   	rof
b2     	dat  1, 1

   	for 8
       	dat.f  $0, $0
   	rof

p3     	spl    1,    1
		mov -1,0
	mov -1,0
	mov -1,0
   	    spl    33707 , 0
   	    mov.i  >-1,    }-1
t3 	    spl    @0,   step
   	    mov.i  }-1,  >-1
   	    mov.i  b3  , <0+t3
    for 3
   	    mov.i  b3  , {0-step-step-step+t3
    rof
b3 	    dat }I13, }I13+I13

    end start
