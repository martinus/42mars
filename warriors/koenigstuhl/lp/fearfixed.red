;redcode-lp
;name Fear of the Unknown
;author John Metcalf
;strategy paper/stone
;assert CORESIZE==8000 && MAXPROCESSES==8

boot    spl    copy,     paper-pstep+5
        spl    1,        inc+4
        spl    1,        <2000
        mov    <boot+1,  <boot
        jmp    >boot,    <4000

        sstep  equ 6742

inc     mov    <sstep,   <-sstep
stone   mov    >sstep*2, 1-sstep*2
        add    inc,      <0
        jmn    >-1,      inc

        for    186
        dat    0,0
        rof

        pstep  equ 5849
        length equ 20

paper   mov    #length,  >length
copy    mov    <paper,   <dest
        jmn    @0,       *copy
        spl    *copy,    <paper+4000
dest    jmz    @dest,    pstep

        end

