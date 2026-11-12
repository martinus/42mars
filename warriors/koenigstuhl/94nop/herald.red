;redcode-94nop
;name Herald of Destruction
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

        x      equ 3712
        y      equ 100
        stepx  equ 9
        stepy  equ 8
        stepz  equ 10
        count  equ 22

first   dat    y,        x+y

        ptr    equ (scan-stepx)

        dat    >0,       0
sbmb    spl    #1,       {1

wipe    mov    @bp,      <ptr
        mov    >ptr,     >ptr
        jmn.f  wipe,     >ptr

scan    sub.f #-stepy,   ptr
        sne.x @ptr,      *ptr
        sub.f #-stepz,   ptr
        jmn.f  hit,      @ptr
        jmz.f  scan,     *ptr

        mov.x  @scan,    @scan
hit     slt.b  @scan,    #last+3-ptr
        djn    wipe,     ptr
        djn    scan,     #count
bp      djn.f  hit-1,    #sbmb

        last   equ (bp+1)

boot    mov    wipe+12,  <bptr
        mov    wipe+11,  <bptr
        mov    wipe+10,  <bptr
        mov    wipe+9,   <bptr
        mov    wipe+8,   <bptr
        mov    wipe+7,   <bptr
        mov    wipe+6,   <bptr
        mov    wipe+5,   <bptr
        mov    wipe+4,   <bptr
bptr    mov    first,    @779
        spl    @bptr
        mov    wipe+3,   <bptr
        mov    wipe+2,   <bptr
        mov    wipe+1,   <bptr
        mov    wipe,     <bptr
        mov    wipe-1,   <bptr
        mov    wipe-2,   <bptr
        dat    1,        1

        for    (MAXLENGTH-CURLINE)/3
        spl    1,        1
        spl    <1,       1
        spl    1,        <1
        rof

        end    boot

