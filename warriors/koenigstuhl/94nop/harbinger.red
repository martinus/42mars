;redcode-94nop
;name Harbinger of Doom
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

        x      equ 5446
        y      equ 100
        stepx  equ 14
        stepy  equ 8
        count  equ 22

first   dat    y,        x+y

        ptr    equ (inc-stepx)

        dat    >0,       0
sbmb    spl    #1,       {1

wipe    mov    @bp,      <ptr
        mov    >ptr,     >ptr
        jmn.f  wipe,     >ptr

scan    sub.x  inc,      ptr
        sne.x  @ptr,     *ptr
inc     sub.x  #-stepy,  ptr
        jmn.f  hit,      @ptr
        jmz.f  scan,     *ptr

        mov.x  @scan,    @scan
hit     slt.b  @scan,    #last+3-ptr
        djn    wipe,     ptr
        djn    inc,      #count
bp      djn.f  inc,      #sbmb

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
bptr    mov    first,    @2707
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

