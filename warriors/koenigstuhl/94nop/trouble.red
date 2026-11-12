;redcode-94nop
;name Trouble
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

        x     equ 3100
        y     equ 600
        stepx equ 11
        stepy equ 16
        count equ 16

ptr     dat   y,        x+y-1

        for   stepx-8
        dat   0,        0
        rof

        dat   >0,       0
sb      spl   #0,       {0

wipe    mov   @bp,      <ptr
        mov   >ptr,     >ptr
        jmn.f wipe,     >ptr

scan    sub.x inc,      ptr
        sne.x @ptr,     *ptr
inc     sub.x #-stepy,  ptr
        jmn.f hit,      @ptr
        jmz.f scan,     *ptr

        mov.x @scan,    @scan
hit     slt.b @scan,    #last+2-ptr
        djn.f wipe,     ptr
        djn   inc,      #count
bp      djn.f inc,      #sb

last    end   scan+1

