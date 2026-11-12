;redcode-94x
;name bishot
;author Jakub Kozisek
;strategy Fizmo's BiShot scanner :). I took it and destroyed it. :(
;assert 1
; CORESIZE==800

dest    equ     (scan+2+40)

scan	add.f	#ptr,	ptr
        sne.i   *ptr,   @ptr
	djn.f	scan,	@ptr
        djn.f   bomb+1, ptr

    for 3
        dat     0,      0
    rof

inc	dat	#1,	#1
ptr	dat     dest,	404+dest
bomb    dat     #0,     #0
   	spl    	#0,     0
loop	mov     bomb,   *ptr
        mov     bomb,   @ptr
	add.f	inc,	ptr
        djn.f   loop,   @ptr

        end     scan+1

