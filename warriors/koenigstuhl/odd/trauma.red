;redcode-94
;name Trauma
;author Zul Nadzri
;strategy Makes them crazy.
;strategy for limited read and write tournament.
;assert 1

war1    spl     1,>4123
        spl     1,>4345
        mov     -1,0
        spl     ULAT2,>4567

        spl     @0,}2345
        mov     }-1,>-1
        spl     @0,}3456
        mov     }-1,>-1
        mov     {-123,{-234
        mov     {-3,<1
        jmp     @0,>3901

pState equ 100

clear	stp #5, #50
	jmp war4, }210
bwash stp #5, #50
	jmp war1, }210

start  ldp.a  #0,  pTab2 
	 sne.a #-1, pTab2
	 jmp clear, }200
	 ldp #50, 0
	 seq #5, -1
	 jmp bwash, }200
	 stp #5, #50

       ldp.a #pState,  pTable
       mod.ba *pTab2,  pTable
       stp.b *pTable, #pState
pTable jmp     }0, 155 
       spl #war4, 156 
       spl #war4,  37 
       spl #war1,  94 
       spl #war1,  59 
       spl #war1, 150 
       jmp #war1, 180 

       dat 0, 0
       dat 0, 0
       spl #1, 1

pTab2  spl #0, 6
       spl #0, 7
       spl #0, 5

;------------------------------------ from juggernaut--------
jam	jmp -30, 8
war4	mov jam,@tgt1
	djn -1,tgt1
jmp 	war2

s	dat		#0
d	dat		#0
count	dat		#25
war2	mov	#0,	s
	mov	#106,	d
	mov	#25,	count
jn	mov	>s,	>d
	mov	>s,	>d
	mov	>s,	>d
	mov	>s,	>d
	djn	jn,	count
 
	jmp	war2+107
 
pit	spl	1
	stp.ab >0, #0
	spl	-2
	jmp	-2
	jmp pit

for 70-23-4-10
jmp pit
rof

tgt1	jmp	pit, 35+10

ULAT2   spl     @0,}3456
        mov     }-1,>-1
        mov     }234,}345
        spl     3,<5100
        spl     2668,<5345
        mov     0,2667
        jmp     -2667,<5567

end start

