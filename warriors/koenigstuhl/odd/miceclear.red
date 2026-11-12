;redcode
;name Mice Clear
;author Zul Nadzri
;assert 1
;strategy Round 19 Tournament
;strategy Multiply and stay alive

gate	equ start-1000
gate2 equ gate-500
gate3 equ gate2-500
gate4 equ gate3-500
gate5 equ gate4-500
gate6 equ gate5-500

start	spl loop2, {3000
	spl k
	spl k
	spl k
	spl k
k	mov ptr2, {gate
	mov ptr2, {gate2
	mov ptr2, {gate3
	mov ptr2, {gate4
	mov ptr2, {gate5
	mov ptr2, {gate6
jmp k, {gate

ptr2    dat     #0     ,  #12
start2  mov     #12    ,  ptr2
loop2   mov     @ptr2   ,  <copy2
        djn     loop2   ,  ptr2
        spl     @copy2  ,  0
        add     #653   ,  copy2
        jmz     start2  ,  ptr2
copy2   dat     }20     ,  #833

end start
