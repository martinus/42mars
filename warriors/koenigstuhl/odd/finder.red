;redcode-odd
;name finder
;author Will 'Varfar'
;assert 1

        org     scan

        X       equ     MINDISTANCE
        step    equ     13 ;whatever
        
scan    seq     -X,     +X
        jmp     found
scan_on add     next,   scan
        jmp     scan
;break
found   add     scan,   ptr
        add     @scan,  ptr
        add     *scan,  ptr
        sne     @scan,  tail
        mov.x   ptr,    ptr
        mov     bait,   @ptr
        jmz     tail,   @ptr
        jmz     tail,   @ptr
        jmz     tail,   @ptr
        mov     reset,  ptr
        jmp     scan_on
ptr     dat     scan,   scan
reset   dat     scan-ptr,scan-ptr
next    dat     -step,  +step
bait    djn     -2,     #1
tail    end
