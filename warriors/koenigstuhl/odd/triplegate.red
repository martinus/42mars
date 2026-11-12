;redcode
;name Triple Gate
;author Levi 
; <levi@gis.net>
;url http://gis.net/~levi/
;strategy A glorified imp gate whith patent-pretending frawd technology.
;strategy (stone:gate,shell,frawd)
;assert 1

;changelog 0.0.0 Non Optimal Constants

uno     spl     0,<-100
        spl     dos,<-100
        jmp     -2,<-100
        dat     0,0
dos     spl     0,<-102
        spl     tres,<-102
        jmp     -2,<-102
        dat     0,0
tres    spl     0,<-104
        spl     uno,<-104
        jmp     -2,<-104

