;redcode
;name S:IRC17b
;author Philip Thorne
;       CORESIZE==2520
;assert 1

start:  spl     imp+(CORESIZE/2)+1
imp:    mov.i   #1,         ((CORESIZE/2)+1)
        mov.i   #1,         ((CORESIZE/2)+1)

    end start
