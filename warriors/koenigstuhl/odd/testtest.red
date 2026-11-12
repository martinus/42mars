;redcode-94nop
;name 123 Test Test
;author Sascha Zapf
;assert 1



start	add.x  *aptr,   *aptr
		div.ab  #2, 	scan
		mul.ab	#8,		dpos
		mul.ab  #5,		dpos
scan    sne    -8,     -8   
aptr    add    inc,     scan   
        mov    bomb,    }scan 
        mov    bomb,    >scan
dpos    djn    scan,    #8

bomb    spl    #1,      1
clear   mov    inc,     >scan  
        djn.f  clear,   >scan
inc     dat    6,      6  


        end start
